import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check - require service role or staff
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is staff
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const staffRoles = ["admin", "founder", "it", "support", "moderator"];
    const isStaff = roles?.some((r: any) => staffRoles.includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const { bug_id } = await req.json();
    if (!bug_id) {
      return new Response(JSON.stringify({ error: "bug_id required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch the bug report
    const { data: bug, error: bugErr } = await supabase
      .from("bug_reports")
      .select("id, description, page_url, created_at")
      .eq("id", bug_id)
      .single();

    if (bugErr || !bug) {
      return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
    }

    // Call AI to process the bug
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a bug report analyst. Analyze bug reports and return structured data.
You MUST respond by calling the classify_bug function. Always classify in Swedish context but use English for category/severity values.`,
          },
          {
            role: "user",
            content: `Analyze this bug report:

Page: ${bug.page_url}
Reported: ${bug.created_at}
Description: ${bug.description}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_bug",
              description: "Classify and structure a bug report",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Short clear summary in Swedish, max 120 chars",
                  },
                  severity: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "Bug severity level",
                  },
                  category: {
                    type: "string",
                    enum: ["UI", "payment", "auth", "system", "performance", "data", "unclear"],
                    description: "Bug category",
                  },
                  repro_steps: {
                    type: "string",
                    description: "Reproduction steps in Swedish, if derivable from description",
                  },
                  clean_prompt: {
                    type: "string",
                    description: "Well-structured version of the bug report in Swedish, suitable for developer handoff",
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Relevant tags (feature area, type, keywords) in Swedish",
                  },
                },
                required: ["summary", "severity", "category", "clean_prompt", "tags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_bug" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again later" }), { status: 429, headers: corsHeaders });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: corsHeaders });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI processing failed" }), { status: 500, headers: corsHeaders });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: corsHeaders });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Map severity to work_item priority
    const severityToPriority: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    // Update bug report with AI data
    await supabase.from("bug_reports").update({
      ai_summary: result.summary,
      ai_category: result.category,
      ai_severity: result.severity,
      ai_tags: result.tags,
      ai_clean_prompt: result.clean_prompt,
      ai_repro_steps: result.repro_steps || null,
      ai_processed_at: new Date().toISOString(),
    }).eq("id", bug_id);

    // Update linked work_item
    const { data: wi } = await supabase
      .from("work_items")
      .select("id")
      .eq("source_type", "bug_report")
      .eq("source_id", bug_id)
      .maybeSingle();

    if (wi) {
      await supabase.from("work_items").update({
        title: `Bug: ${result.summary}`,
        description: result.clean_prompt,
        priority: severityToPriority[result.severity] || "medium",
      }).eq("id", wi.id);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-bug-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
