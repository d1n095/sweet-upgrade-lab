import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { storeConfig } from '@/config/storeConfig';

const TermsConditions = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Allmänna Villkor',
      badge: 'Villkor',
      sections: [
        { title: 'Allmänt', text: `Dessa allmänna villkor gäller för alla köp som görs via vår webbplats. Genom att genomföra ett köp godkänner du dessa villkor i sin helhet.` },
        { title: 'Företagsinformation', text: `4ThePeople är en europeisk e-handelsverksamhet med säte i EU. Vi agerar som förmedlare mellan våra leverantörer och dig som kund.` },
        { title: 'Priser och betalning', text: `Alla priser anges i SEK inklusive moms (25%). Betalning sker via säkra betalningslösningar (kort, Klarna, Swish).` },
        { title: 'Orderbekräftelse', text: `Efter genomfört köp skickas en orderbekräftelse till din e-postadress. Denna bekräftelse utgör ditt kvitto.` },
        { title: 'Leverans och orderhantering', text: `Leveranstiden är normalt ${storeConfig.shipping.deliveryTime.sv}. Du får spårningsinformation via e-post.` },
        { title: 'Ångerrätt', text: `Enligt distansavtalslagen har du ${storeConfig.returns.period} dagars ångerrätt. Kontakta oss på ${storeConfig.contact.email} för att påbörja en retur.` },
        { title: 'Reklamation', text: `Du har minst 3 års reklamationsrätt på fabriksfel enligt konsumentköplagen.` },
        { title: 'Force Majeure', text: `Vi ansvarar inte för förseningar orsakade av omständigheter utanför vår kontroll.` },
        { title: 'Tvistelösning', text: `Vid eventuell tvist följer vi svensk lagstiftning. Du kan vända dig till Allmänna Reklamationsnämnden (ARN).` }
      ]
    },
    en: {
      title: 'Terms & Conditions',
      badge: 'Terms',
      sections: [
        { title: 'General', text: `These general terms apply to all purchases made through our website. By completing a purchase, you agree to these terms in full.` },
        { title: 'Company Information', text: `4ThePeople is a European e-commerce business based in the EU. We act as an intermediary between our suppliers and you as a customer.` },
        { title: 'Prices and Payment', text: `All prices are in SEK including VAT (25%). Payment is made through secure payment solutions (card, Klarna, Swish).` },
        { title: 'Order Confirmation', text: `After completing your purchase, an order confirmation is sent to your email address. This confirmation serves as your receipt.` },
        { title: 'Delivery and Order Handling', text: `Delivery time is normally ${storeConfig.shipping.deliveryTime.en}. You will receive tracking information via email.` },
        { title: 'Right of Withdrawal', text: `According to the Distance Selling Act, you have ${storeConfig.returns.period} days right of withdrawal. Contact us at ${storeConfig.contact.email} to initiate a return.` },
        { title: 'Complaints', text: `You always have at least 3 years warranty on manufacturing defects.` },
        { title: 'Force Majeure', text: `We are not responsible for delays caused by circumstances beyond our control.` },
        { title: 'Dispute Resolution', text: `In case of a dispute, we follow Swedish law. You can contact the National Board for Consumer Disputes (ARN).` }
      ]
    },
    no: {
      title: 'Vilkår og betingelser',
      badge: 'Vilkår',
      sections: [
        { title: 'Generelt', text: 'Disse generelle vilkårene gjelder for alle kjøp gjort via vår nettside.' },
        { title: 'Firmainfo', text: '4ThePeople er en europeisk e-handelsvirksomhet basert i EU.' },
        { title: 'Priser og betaling', text: 'Alle priser er i SEK inkludert MVA. Betaling skjer via sikre betalingsløsninger.' },
        { title: 'Ordrebekreftelse', text: 'En ordrebekreftelse sendes til din e-postadresse etter kjøp.' },
        { title: 'Levering', text: `Normal leveringstid er 7-10 virkedager.` },
        { title: 'Angrerett', text: `Du har ${storeConfig.returns.period} dagers angrerett.` },
        { title: 'Reklamasjon', text: 'Du har minst 3 års reklamasjonsrett på fabriksfeil.' },
        { title: 'Force Majeure', text: 'Vi er ikke ansvarlige for forsinkelser utenfor vår kontroll.' },
        { title: 'Tvister', text: 'Tvister løses etter svensk lov.' }
      ]
    },
    da: {
      title: 'Vilkår og betingelser',
      badge: 'Vilkår',
      sections: [
        { title: 'Generelt', text: 'Disse generelle vilkår gælder for alle køb foretaget via vores hjemmeside.' },
        { title: 'Virksomhedsoplysninger', text: '4ThePeople er en europæisk e-handelsvirksomhed baseret i EU.' },
        { title: 'Priser og betaling', text: 'Alle priser er i SEK inklusiv moms. Betaling sker via sikre betalingsløsninger.' },
        { title: 'Ordrebekræftelse', text: 'En ordrebekræftelse sendes til din e-mailadresse efter køb.' },
        { title: 'Levering', text: `Normal leveringstid er 7-10 hverdage.` },
        { title: 'Fortrydelsesret', text: `Du har ${storeConfig.returns.period} dages fortrydelsesret.` },
        { title: 'Reklamation', text: 'Du har mindst 3 års reklamationsret på fabriksfejl.' },
        { title: 'Force Majeure', text: 'Vi er ikke ansvarlige for forsinkelser uden for vores kontrol.' },
        { title: 'Tvister', text: 'Tvister afgøres efter svensk lovgivning.' }
      ]
    },
    de: {
      title: 'Allgemeine Geschäftsbedingungen',
      badge: 'AGB',
      sections: [
        { title: 'Allgemeines', text: 'Diese AGB gelten für alle Käufe über unsere Website.' },
        { title: 'Unternehmensinfo', text: '4ThePeople ist ein europäisches E-Commerce-Unternehmen mit Sitz in der EU.' },
        { title: 'Preise und Zahlung', text: 'Alle Preise sind in SEK inkl. MwSt. Zahlung erfolgt über sichere Zahlungslösungen.' },
        { title: 'Bestellbestätigung', text: 'Nach Abschluss erhalten Sie eine Bestellbestätigung per E-Mail.' },
        { title: 'Lieferung', text: `Normale Lieferzeit beträgt 7-10 Werktage.` },
        { title: 'Widerrufsrecht', text: `Sie haben ${storeConfig.returns.period} Tage Widerrufsrecht.` },
        { title: 'Reklamation', text: 'Sie haben mindestens 3 Jahre Garantie auf Herstellungsfehler.' },
        { title: 'Force Majeure', text: 'Wir haften nicht für Verzögerungen außerhalb unserer Kontrolle.' },
        { title: 'Streitbeilegung', text: 'Streitigkeiten werden nach schwedischem Recht geregelt.' }
      ]
    },
    fi: {
      title: 'Käyttöehdot',
      badge: 'Ehdot',
      sections: [
        { title: 'Yleistä', text: 'Nämä ehdot koskevat kaikkia verkkosivustomme kautta tehtyjä ostoksia.' },
        { title: 'Yritystiedot', text: '4ThePeople on eurooppalainen verkkokauppayritys, jolla on kotipaikka EU:ssa.' },
        { title: 'Hinnat ja maksaminen', text: 'Kaikki hinnat ovat SEK sisältäen ALV:n. Maksu tapahtuu turvallisten maksuratkaisujen kautta.' },
        { title: 'Tilausvahvistus', text: 'Tilauksesi jälkeen saat tilausvahvistuksen sähköpostitse.' },
        { title: 'Toimitus', text: 'Normaali toimitusaika on 7-10 arkipäivää.' },
        { title: 'Peruutusoikeus', text: `Sinulla on ${storeConfig.returns.period} päivän peruutusoikeus.` },
        { title: 'Reklamaatio', text: 'Sinulla on vähintään 3 vuoden takuu valmistusvirheille.' },
        { title: 'Force Majeure', text: 'Emme vastaa hallintamme ulkopuolisista viivästyksistä.' },
        { title: 'Riitojen ratkaisu', text: 'Riidat ratkaistaan Ruotsin lain mukaan.' }
      ]
    },
    nl: {
      title: 'Algemene Voorwaarden',
      badge: 'Voorwaarden',
      sections: [
        { title: 'Algemeen', text: 'Deze voorwaarden zijn van toepassing op alle aankopen via onze website.' },
        { title: 'Bedrijfsinformatie', text: '4ThePeople is een Europees e-commercebedrijf gevestigd in de EU.' },
        { title: 'Prijzen en betaling', text: 'Alle prijzen zijn in SEK inclusief BTW. Betaling via veilige betaaloplossingen.' },
        { title: 'Orderbevestiging', text: 'Na voltooiing ontvangt u een orderbevestiging per e-mail.' },
        { title: 'Levering', text: 'Normale levertijd is 7-10 werkdagen.' },
        { title: 'Herroepingsrecht', text: `U heeft ${storeConfig.returns.period} dagen herroepingsrecht.` },
        { title: 'Klachten', text: 'U heeft minimaal 3 jaar garantie op fabricagefouten.' },
        { title: 'Overmacht', text: 'Wij zijn niet aansprakelijk voor vertragingen buiten onze controle.' },
        { title: 'Geschillenbeslechting', text: 'Geschillen worden geregeld naar Zweeds recht.' }
      ]
    },
    fr: {
      title: 'Conditions Générales de Vente',
      badge: 'CGV',
      sections: [
        { title: 'Généralités', text: 'Ces CGV s\'appliquent à tous les achats effectués sur notre site.' },
        { title: 'Informations sur l\'entreprise', text: '4ThePeople est une entreprise européenne de commerce en ligne basée dans l\'UE.' },
        { title: 'Prix et paiement', text: 'Tous les prix sont en SEK TTC. Le paiement s\'effectue via des solutions de paiement sécurisées.' },
        { title: 'Confirmation de commande', text: 'Après validation, vous recevrez une confirmation de commande par e-mail.' },
        { title: 'Livraison', text: 'Le délai de livraison normal est de 7 à 10 jours ouvrables.' },
        { title: 'Droit de rétractation', text: `Vous disposez de ${storeConfig.returns.period} jours de droit de rétractation.` },
        { title: 'Réclamation', text: 'Vous bénéficiez d\'au moins 3 ans de garantie contre les défauts de fabrication.' },
        { title: 'Force Majeure', text: 'Nous ne sommes pas responsables des retards indépendants de notre volonté.' },
        { title: 'Résolution des litiges', text: 'Les litiges sont réglés selon le droit suédois.' }
      ]
    },
    es: {
      title: 'Términos y Condiciones',
      badge: 'T&C',
      sections: [
        { title: 'General', text: 'Estos términos se aplican a todas las compras realizadas en nuestro sitio web.' },
        { title: 'Información de la empresa', text: '4ThePeople es una empresa europea de comercio electrónico con sede en la UE.' },
        { title: 'Precios y pago', text: 'Todos los precios están en SEK con IVA incluido. El pago se realiza a través de soluciones de pago seguras.' },
        { title: 'Confirmación de pedido', text: 'Tras la compra, recibirá una confirmación de pedido por correo electrónico.' },
        { title: 'Entrega', text: 'El plazo de entrega normal es de 7 a 10 días hábiles.' },
        { title: 'Derecho de desistimiento', text: `Tiene ${storeConfig.returns.period} días de derecho de desistimiento.` },
        { title: 'Reclamación', text: 'Dispone de al menos 3 años de garantía por defectos de fabricación.' },
        { title: 'Fuerza Mayor', text: 'No somos responsables de retrasos fuera de nuestro control.' },
        { title: 'Resolución de disputas', text: 'Las disputas se resuelven según el derecho sueco.' }
      ]
    },
    pl: {
      title: 'Regulamin',
      badge: 'Regulamin',
      sections: [
        { title: 'Postanowienia ogólne', text: 'Niniejszy regulamin dotyczy wszystkich zakupów dokonanych za pośrednictwem naszej strony.' },
        { title: 'Informacje o firmie', text: '4ThePeople to europejska firma e-commerce z siedzibą w UE.' },
        { title: 'Ceny i płatności', text: 'Wszystkie ceny podane są w SEK z VAT. Płatność realizowana jest przez bezpieczne rozwiązania płatnicze.' },
        { title: 'Potwierdzenie zamówienia', text: 'Po złożeniu zamówienia otrzymasz potwierdzenie zamówienia e-mailem.' },
        { title: 'Dostawa', text: 'Normalny czas dostawy wynosi 7-10 dni roboczych.' },
        { title: 'Prawo do odstąpienia', text: `Masz ${storeConfig.returns.period} dni prawa do odstąpienia od umowy.` },
        { title: 'Reklamacja', text: 'Przysługuje Ci co najmniej 3 lata gwarancji na wady produkcyjne.' },
        { title: 'Siła wyższa', text: 'Nie ponosimy odpowiedzialności za opóźnienia poza naszą kontrolą.' },
        { title: 'Rozstrzyganie sporów', text: 'Spory regulowane są zgodnie z prawem szwedzkim.' }
      ]
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={({
            sv: 'Läs våra allmänna villkor för köp, priser och betalning.',
            en: 'Read our terms and conditions for purchases, prices and payment.',
            no: 'Les våre generelle vilkår for kjøp, priser og betaling.',
            da: 'Læs vores generelle betingelser for køb, priser og betaling.',
            de: 'Lesen Sie unsere allgemeinen Geschäftsbedingungen für Käufe, Preise und Zahlung.',
            fi: 'Lue yleiset ehtomme ostoista, hinnoista ja maksamisesta.',
            nl: 'Lees onze algemene voorwaarden voor aankopen, prijzen en betaling.',
            fr: 'Lisez nos conditions générales pour les achats, les prix et le paiement.',
            es: 'Lea nuestros términos y condiciones para compras, precios y pagos.',
            pl: 'Przeczytaj nasze ogólne warunki dotyczące zakupów, cen i płatności.',
          } as Record<string, string>)[language] ?? 'Read our terms and conditions for purchases, prices and payment.'}
        canonical="/policies/terms"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {t.title}
            </h1>
            
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
              {t.sections.map((section, index) => (
                <motion.div 
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                    {section.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {section.text}
                  </p>
                </motion.div>
              ))}
              
              <div className="mt-12 p-6 bg-secondary/50 rounded-2xl">
                <p className="text-sm text-muted-foreground">
                  {language === 'sv' 
                    ? `Senast uppdaterad: Januari 2026. Vid frågor kontakta oss på ${storeConfig.contact.email}`
                    : `Last updated: January 2026. For questions contact us at ${storeConfig.contact.email}`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsConditions;