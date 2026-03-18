
CREATE TABLE public.shipping_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  pricing_url text,
  tracking_url_template text,
  is_selected boolean NOT NULL DEFAULT false,
  is_international boolean NOT NULL DEFAULT false,
  supports_pickup_points boolean NOT NULL DEFAULT false,
  supports_home_delivery boolean NOT NULL DEFAULT true,
  supports_express boolean NOT NULL DEFAULT false,
  supports_parcel_lockers boolean NOT NULL DEFAULT false,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage shipping carriers" ON public.shipping_carriers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view shipping carriers" ON public.shipping_carriers FOR SELECT TO anon, authenticated
  USING (true);

-- Seed Swedish shipping carriers
INSERT INTO public.shipping_carriers (name, website_url, pricing_url, is_international, supports_pickup_points, supports_home_delivery, supports_express, supports_parcel_lockers, display_order) VALUES
('PostNord', 'https://www.postnord.se', 'https://www.postnord.se/skicka-paket/priser', true, true, true, true, true, 0),
('DHL', 'https://www.dhl.com/se-sv', 'https://www.dhl.com/se-sv/home/vara-divisioner/paket/privatkund/priser.html', true, true, true, true, true, 1),
('Schenker (DB Schenker)', 'https://www.dbschenker.com/se-sv', 'https://www.dbschenker.com/se-sv/produkter/landtransporter', true, true, true, false, false, 2),
('Budbee', 'https://www.budbee.com/se', 'https://www.budbee.com/se', false, false, true, true, true, 3),
('Instabox', 'https://www.instabox.se', 'https://www.instabox.se', false, false, false, true, true, 4),
('Best Transport', 'https://www.best.se', 'https://www.best.se', false, false, true, true, false, 5),
('Early Bird', 'https://www.earlybird.se', 'https://www.earlybird.se', false, false, true, true, false, 6),
('UPS', 'https://www.ups.com/se', 'https://www.ups.com/se/sv/shipping/rates.page', true, true, true, true, true, 7),
('FedEx', 'https://www.fedex.com/sv-se', 'https://www.fedex.com/sv-se/shipping/rates.html', true, false, true, true, false, 8),
('TNT (FedEx)', 'https://www.tnt.com/express/sv_se', 'https://www.tnt.com/express/sv_se/site/shipping-tools/rate-quote.html', true, false, true, true, false, 9),
('Bring', 'https://www.bring.se', 'https://www.bring.se/skicka/priser', true, true, true, true, true, 10),
('GLS', 'https://gls-group.com/SE/sv', 'https://gls-group.com/SE/sv/foretag/priser', true, true, true, false, true, 11),
('Airmee', 'https://www.airmee.com', 'https://www.airmee.com', false, false, true, true, false, 12),
('Jetpak', 'https://www.jetpak.com/se', 'https://www.jetpak.com/se/tjanster', false, false, true, true, false, 13),
('CityMail', 'https://www.citymail.se', 'https://www.citymail.se', false, false, true, false, false, 14),
('Mailbox (Now Instabox)', 'https://www.instabox.se', 'https://www.instabox.se', false, false, false, false, true, 15),
('DSV', 'https://www.dsv.com/sv-se', 'https://www.dsv.com/sv-se', true, false, true, false, false, 16),
('Posti (Finland/Sverige)', 'https://www.posti.fi/sv', 'https://www.posti.fi/sv/kundtjanst/priser', true, true, true, false, true, 17),
('Hélthjem', 'https://helthjem.se', 'https://helthjem.se', false, false, true, false, false, 18),
('Dooris', 'https://www.dooris.se', 'https://www.dooris.se', false, false, true, true, false, 19);
