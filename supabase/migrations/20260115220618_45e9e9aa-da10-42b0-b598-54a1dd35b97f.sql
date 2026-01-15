-- Create legal documents table for admin management
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL UNIQUE,
  title_sv TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_sv TEXT NOT NULL,
  content_en TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Everyone can view active documents
CREATE POLICY "Anyone can view active legal documents"
  ON public.legal_documents
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all documents
CREATE POLICY "Admins can manage all legal documents"
  ON public.legal_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create document versions table for history
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title_sv TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_sv TEXT NOT NULL,
  content_en TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

-- Admins can view document versions
CREATE POLICY "Admins can view document versions"
  ON public.legal_document_versions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create document versions
CREATE POLICY "Admins can create document versions"
  ON public.legal_document_versions
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create affiliate applications table
CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  social_media TEXT,
  followers_count TEXT,
  platform TEXT,
  why_join TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can apply (insert)
CREATE POLICY "Anyone can apply to affiliate program"
  ON public.affiliate_applications
  FOR INSERT
  WITH CHECK (true);

-- Admins can view and manage applications
CREATE POLICY "Admins can manage affiliate applications"
  ON public.affiliate_applications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default legal documents
INSERT INTO public.legal_documents (document_type, title_sv, title_en, content_sv, content_en) VALUES
('terms', 'Allmänna Villkor', 'Terms & Conditions', 
'# Allmänna Villkor - 4ThePeople

## 1. ACCEPTANS
Genom att använda våra tjänster godkänner du dessa villkor.

## 2. PRODUKTER & TJÄNSTER
- Vi säljer noggrant utvalda produkter från certifierade leverantörer
- Alla produkter beskrivs så noggrant som möjligt
- Bilder kan avvika något från verkligheten p.g.a. skärminställningar

## 3. PRISER & BETALNING
- Priser anges i SEK inklusive moms
- Vi förbehåller oss rätten att korrigera uppenbara fel
- Betalning sker via säkra tredjepartslösningar

## 4. LEVERANS & RETURER
- Leveranstid: 7-10 arbetsdagar
- 14 dagars ångerrätt på oöppnade produkter
- Returfrakt betalas av kunden (undantag vid fel från vår sida)

## 5. ANSVARSBEGRÄNSNING
- Vi ansvarar för produktens kvalitet enligt konsumentköplagen
- Vi ansvarar inte för förseningar orsakade av fraktbolag
- Maxersättning: produktens köppris

## 6. PERSONUPPGIFTER
- Vi behandlar data enligt GDPR
- Endast nödvändig data för orderhantering
- Kunden kan när som helst begära borttagning',
'# Terms & Conditions - 4ThePeople

## 1. ACCEPTANCE
By using our services, you agree to these terms.

## 2. PRODUCTS & SERVICES
- We sell carefully selected products from certified suppliers
- All products are described as accurately as possible
- Images may differ slightly from reality due to screen settings

## 3. PRICES & PAYMENT
- Prices are in SEK including VAT
- We reserve the right to correct obvious errors
- Payment is made via secure third-party solutions

## 4. DELIVERY & RETURNS
- Delivery time: 7-10 business days
- 14-day right of withdrawal on unopened products
- Return shipping is paid by the customer (except for errors on our part)

## 5. LIMITATION OF LIABILITY
- We are responsible for product quality according to consumer law
- We are not responsible for delays caused by shipping companies
- Maximum compensation: product purchase price

## 6. PERSONAL DATA
- We process data according to GDPR
- Only necessary data for order processing
- Customer can request deletion at any time'),

('affiliate', 'Affiliate-avtal', 'Affiliate Agreement',
'# Affiliate-samarbete med 4ThePeople

## 1. PARTER
4ThePeople (vi) och affiliaten (du) ingår detta avtal.

## 2. TJÄNSTEN
Du marknadsför våra produkter med din unika rabattkod. Kunder får rabatt, du får provision på försäljning.

## 3. PROVISION
- Du får provision på 5-15% beroende på överenskommelse
- Beräknas på ordervärdet efter kundrabatt
- Utbetalning sker vid begäran, minsta belopp: 1 kr

## 4. ANSVAR
- Du ansvarar för din egen marknadsföring
- Du följer etiska riktlinjer (ingen spam, falska påståenden)
- Vi ansvarar för produktkvalitet och leverans

## 5. UPPSÄGNING
- Omedelbar uppsägning vid villkorsbrott
- 30 dagars uppsägningstid vid vanlig uppsägning
- Provision betalas ut för intjänade belopp

## 6. SKATT
- Du ansvarar för att redovisa intäkter till Skatteverket
- Vi tillhandahåller transaktionsdata vid begäran',
'# Affiliate Partnership with 4ThePeople

## 1. PARTIES
4ThePeople (we) and the affiliate (you) enter into this agreement.

## 2. THE SERVICE
You market our products with your unique discount code. Customers get a discount, you get commission on sales.

## 3. COMMISSION
- You receive 5-15% commission depending on agreement
- Calculated on order value after customer discount
- Payout upon request, minimum amount: 1 SEK

## 4. RESPONSIBILITY
- You are responsible for your own marketing
- You follow ethical guidelines (no spam, false claims)
- We are responsible for product quality and delivery

## 5. TERMINATION
- Immediate termination for breach of terms
- 30-day notice for regular termination
- Commission paid for earned amounts

## 6. TAX
- You are responsible for reporting income to tax authorities
- We provide transaction data upon request'),

('privacy', 'Integritetspolicy', 'Privacy Policy',
'# Integritetspolicy - 4ThePeople

## 1. ANSVARIG
4ThePeople är ansvarig för behandlingen av dina personuppgifter.

## 2. VILKA UPPGIFTER VI SAMLAR
- Kontaktinformation (namn, email, telefon)
- Leveransadress
- Orderhistorik
- Betalningsinformation (hanteras av tredje part)

## 3. HUR VI ANVÄNDER DINA UPPGIFTER
- Hantera och leverera beställningar
- Kommunicera om din order
- Förbättra våra tjänster
- Skicka nyhetsbrev (med ditt samtycke)

## 4. DINA RÄTTIGHETER
- Tillgång till dina uppgifter
- Rättelse av felaktiga uppgifter
- Radering av uppgifter
- Begränsning av behandling
- Dataportabilitet

## 5. LAGRING
- Vi lagrar data så länge det är nödvändigt
- Automatisk radering efter 2 år inaktivitet
- Bokföringsdata sparas i 7 år enligt lag

## 6. KONTAKT
Kontakta oss på hello@4thepeople.eu för frågor om dina uppgifter.',
'# Privacy Policy - 4ThePeople

## 1. CONTROLLER
4ThePeople is responsible for the processing of your personal data.

## 2. DATA WE COLLECT
- Contact information (name, email, phone)
- Delivery address
- Order history
- Payment information (handled by third party)

## 3. HOW WE USE YOUR DATA
- Manage and deliver orders
- Communicate about your order
- Improve our services
- Send newsletters (with your consent)

## 4. YOUR RIGHTS
- Access to your data
- Correction of incorrect data
- Deletion of data
- Restriction of processing
- Data portability

## 5. STORAGE
- We store data as long as necessary
- Automatic deletion after 2 years of inactivity
- Accounting data saved for 7 years by law

## 6. CONTACT
Contact us at hello@4thepeople.eu for questions about your data.')
ON CONFLICT (document_type) DO NOTHING;