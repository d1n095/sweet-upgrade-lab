
INSERT INTO public.page_sections (page, section_key, title_sv, title_en, content_sv, content_en, icon, is_visible, display_order) VALUES
  -- Home page sections
  ('home', 'hero', 'Giftfria produkter för hela Europa', 'Toxin-free products for all of Europe', 'Noggrant utvalda, internationellt certifierade produkter – till ärliga priser.', 'Carefully curated, internationally certified products – at honest prices.', NULL, true, 0),
  ('home', 'philosophy', 'Hur vi väljer produkter', 'How we select products', NULL, NULL, NULL, true, 1),
  ('home', 'philosophy_step_1', 'Ingrediensanalys', 'Ingredient analysis', 'Vi granskar varje ingredienslista och undviker skadliga ämnen.', 'We review every ingredient list and avoid harmful substances.', 'FlaskConical', true, 2),
  ('home', 'philosophy_step_2', 'Certifieringar', 'Certifications', 'Internationella certifieringar från oberoende organisationer.', 'International certifications from independent organisations.', 'ShieldCheck', true, 3),
  ('home', 'philosophy_step_3', 'Användarrecensioner', 'User reviews', 'Vi analyserar globala omdömen för verklig kvalitet.', 'We analyse global reviews for real-world quality.', 'Search', true, 4),
  ('home', 'about_compact', 'Om 4thepeople', 'About 4thepeople', 'Giftfria produkter, granskade mot internationella certifieringar.', 'Toxin-free products, reviewed against international certifications.', NULL, true, 5),
  -- Contact page sections
  ('contact', 'heading', 'Kontakta oss', 'Contact us', 'Har du frågor, feedback eller funderingar? Vi finns här för att hjälpa dig.', 'Have questions, feedback or concerns? We are here to help.', NULL, true, 0),
  ('contact', 'form', 'Skicka meddelande', 'Send a message', NULL, NULL, NULL, true, 1),
  ('contact', 'info', 'Kontaktinformation', 'Contact information', NULL, NULL, NULL, true, 2),
  ('contact', 'faq_link', 'Vanliga frågor', 'Frequently asked questions', 'Kolla in våra vanliga frågor för snabba svar.', 'Check out our FAQ for quick answers.', NULL, true, 3)
ON CONFLICT DO NOTHING;
