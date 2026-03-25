
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_conversation ON public.ai_chat_messages(conversation_id, created_at);
CREATE INDEX idx_ai_chat_messages_user ON public.ai_chat_messages(user_id);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage own chat messages"
  ON public.ai_chat_messages
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()) AND user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) AND user_id = auth.uid());
