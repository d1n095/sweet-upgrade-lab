import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, DollarSign, TrendingUp, Users, Check, 
  ArrowRight, Gift, Wallet, Loader2, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AffiliateLanding = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    social_media: '',
    followers_count: '',
    platform: '',
    why_join: '',
  });

  const content = {
    sv: {
      badge: 'Affiliate-program',
      title: 'Tjäna pengar genom att dela produkter du älskar',
      subtitle: 'Gå med i vårt affiliate-program och tjäna provision på varje försäljning. Ingen startavgift, inga dolda kostnader.',
      benefits: [
        { icon: DollarSign, title: 'Upp till 15% provision', desc: 'Tjäna på varje försäljning du genererar' },
        { icon: Gift, title: '10% rabatt till dina följare', desc: 'Dina följare får rabatt med din kod' },
        { icon: Wallet, title: 'Flexibla utbetalningar', desc: 'Ta ut när som helst, från 1 kr' },
        { icon: TrendingUp, title: 'Realtidsstatistik', desc: 'Följ dina intäkter i din dashboard' },
      ],
      howItWorks: 'Så fungerar det',
      steps: [
        { step: '1', title: 'Ansök', desc: 'Fyll i formuläret nedan' },
        { step: '2', title: 'Godkänns', desc: 'Vi granskar din ansökan inom 24h' },
        { step: '3', title: 'Dela', desc: 'Få din unika kod och börja tjäna' },
        { step: '4', title: 'Tjäna', desc: 'Provision på varje försäljning' },
      ],
      formTitle: 'Ansök nu',
      formSubtitle: 'Fyll i dina uppgifter så hör vi av oss inom 24 timmar',
      name: 'Namn',
      email: 'Email',
      phone: 'Telefon (valfritt)',
      socialMedia: 'Sociala medier-profil',
      followersCount: 'Antal följare',
      platform: 'Huvudsaklig plattform',
      whyJoin: 'Varför vill du bli affiliate?',
      submit: 'Skicka ansökan',
      successTitle: 'Tack för din ansökan!',
      successMessage: 'Vi granskar din ansökan och hör av oss inom 24 timmar.',
      faq: 'Vanliga frågor',
      faqs: [
        { q: 'Hur mycket kan jag tjäna?', a: 'Det beror på din målgrupp. Våra bästa affiliates tjänar flera tusen kronor per månad.' },
        { q: 'När får jag min provision?', a: 'Du kan begära utbetalning när som helst direkt i din dashboard.' },
        { q: 'Behöver jag betala skatt?', a: 'Ja, du ansvarar för att redovisa dina intäkter till Skatteverket.' },
        { q: 'Kan jag vara affiliate om jag har få följare?', a: 'Ja! Vi värderar engagemang högre än antal följare.' },
      ],
      selectPlatform: 'Välj plattform',
      selectCount: 'Välj antal',
      other: 'Annat',
      errorSomethingWrong: 'Något gick fel',
      seoTitle: 'Affiliate-program - Tjäna pengar',
      seoDescription: 'Gå med i vårt affiliate-program och tjäna upp till 15% provision på varje försäljning.',
    },
    en: {
      badge: 'Affiliate Program',
      title: 'Earn money by sharing products you love',
      subtitle: 'Join our affiliate program and earn commission on every sale. No startup fee, no hidden costs.',
      benefits: [
        { icon: DollarSign, title: 'Up to 15% commission', desc: 'Earn on every sale you generate' },
        { icon: Gift, title: '10% discount for your followers', desc: 'Your followers get discount with your code' },
        { icon: Wallet, title: 'Flexible payouts', desc: 'Withdraw anytime, from 1 SEK' },
        { icon: TrendingUp, title: 'Real-time stats', desc: 'Track your earnings in your dashboard' },
      ],
      howItWorks: 'How it works',
      steps: [
        { step: '1', title: 'Apply', desc: 'Fill in the form below' },
        { step: '2', title: 'Get approved', desc: 'We review your application within 24h' },
        { step: '3', title: 'Share', desc: 'Get your unique code and start earning' },
        { step: '4', title: 'Earn', desc: 'Commission on every sale' },
      ],
      formTitle: 'Apply now',
      formSubtitle: "Fill in your details and we'll get back to you within 24 hours",
      name: 'Name',
      email: 'Email',
      phone: 'Phone (optional)',
      socialMedia: 'Social media profile',
      followersCount: 'Number of followers',
      platform: 'Main platform',
      whyJoin: 'Why do you want to become an affiliate?',
      submit: 'Submit application',
      successTitle: 'Thank you for your application!',
      successMessage: "We'll review your application and get back to you within 24 hours.",
      faq: 'FAQ',
      faqs: [
        { q: 'How much can I earn?', a: 'It depends on your audience. Our top affiliates earn several thousand SEK per month.' },
        { q: 'When do I get my commission?', a: 'You can request payout anytime directly in your dashboard.' },
        { q: 'Do I need to pay taxes?', a: 'Yes, you are responsible for reporting your income to the tax authorities.' },
        { q: 'Can I be an affiliate with few followers?', a: 'Yes! We value engagement more than follower count.' },
      ],
      selectPlatform: 'Select platform',
      selectCount: 'Select count',
      other: 'Other',
      errorSomethingWrong: 'Something went wrong',
      seoTitle: 'Affiliate Program - Earn Money',
      seoDescription: 'Join our affiliate program and earn up to 15% commission on every sale.',
    },
    no: {
      badge: 'Affiliateprogram',
      title: 'Tjen penger ved å dele produkter du elsker',
      subtitle: 'Bli med i affiliateprogrammet vårt og tjen provisjon på hvert salg. Ingen startavgift, ingen skjulte kostnader.',
      benefits: [
        { icon: DollarSign, title: 'Opptil 15% provisjon', desc: 'Tjen på hvert salg du genererer' },
        { icon: Gift, title: '10% rabatt til følgerne dine', desc: 'Følgerne dine får rabatt med koden din' },
        { icon: Wallet, title: 'Fleksible utbetalinger', desc: 'Ta ut når som helst' },
        { icon: TrendingUp, title: 'Sanntidsstatistikk', desc: 'Følg inntektene dine i dashbordet' },
      ],
      howItWorks: 'Slik fungerer det',
      steps: [
        { step: '1', title: 'Søk', desc: 'Fyll inn skjemaet nedenfor' },
        { step: '2', title: 'Godkjennes', desc: 'Vi gjennomgår søknaden din innen 24t' },
        { step: '3', title: 'Del', desc: 'Få din unike kode og begynn å tjene' },
        { step: '4', title: 'Tjen', desc: 'Provisjon på hvert salg' },
      ],
      formTitle: 'Søk nå',
      formSubtitle: 'Fyll inn detaljene dine, så tar vi kontakt innen 24 timer',
      name: 'Navn',
      email: 'E-post',
      phone: 'Telefon (valgfritt)',
      socialMedia: 'Sosiale medier-profil',
      followersCount: 'Antall følgere',
      platform: 'Hovedplattform',
      whyJoin: 'Hvorfor vil du bli affiliate?',
      submit: 'Send søknad',
      successTitle: 'Takk for søknaden din!',
      successMessage: 'Vi gjennomgår søknaden din og tar kontakt innen 24 timer.',
      faq: 'Vanlige spørsmål',
      faqs: [
        { q: 'Hvor mye kan jeg tjene?', a: 'Det avhenger av målgruppen din. Våre beste affiliates tjener flere tusen kroner per måned.' },
        { q: 'Når får jeg provisjonen min?', a: 'Du kan be om utbetaling når som helst direkte i dashbordet ditt.' },
        { q: 'Må jeg betale skatt?', a: 'Ja, du er ansvarlig for å rapportere inntektene dine til skattemyndighetene.' },
        { q: 'Kan jeg være affiliate med få følgere?', a: 'Ja! Vi verdsetter engasjement mer enn antall følgere.' },
      ],
      selectPlatform: 'Velg plattform',
      selectCount: 'Velg antall',
      other: 'Annet',
      errorSomethingWrong: 'Noe gikk galt',
      seoTitle: 'Affiliateprogram - Tjen penger',
      seoDescription: 'Bli med i affiliateprogrammet vårt og tjen opptil 15% provisjon på hvert salg.',
    },
    da: {
      badge: 'Affiliate-program',
      title: 'Tjen penge ved at dele produkter, du elsker',
      subtitle: 'Tilmeld dig vores affiliate-program og tjen provision på hvert salg. Ingen startgebyr, ingen skjulte omkostninger.',
      benefits: [
        { icon: DollarSign, title: 'Op til 15% provision', desc: 'Tjen på hvert salg, du genererer' },
        { icon: Gift, title: '10% rabat til dine følgere', desc: 'Dine følgere får rabat med din kode' },
        { icon: Wallet, title: 'Fleksible udbetalinger', desc: 'Hæv når som helst' },
        { icon: TrendingUp, title: 'Realtidsstatistik', desc: 'Følg dine indtægter i dit dashboard' },
      ],
      howItWorks: 'Sådan fungerer det',
      steps: [
        { step: '1', title: 'Ansøg', desc: 'Udfyld formularen nedenfor' },
        { step: '2', title: 'Godkendes', desc: 'Vi gennemgår din ansøgning inden for 24t' },
        { step: '3', title: 'Del', desc: 'Få din unikke kode og begynd at tjene' },
        { step: '4', title: 'Tjen', desc: 'Provision på hvert salg' },
      ],
      formTitle: 'Ansøg nu',
      formSubtitle: 'Udfyld dine oplysninger, og vi vender tilbage inden for 24 timer',
      name: 'Navn',
      email: 'E-mail',
      phone: 'Telefon (valgfrit)',
      socialMedia: 'Sociale medier-profil',
      followersCount: 'Antal følgere',
      platform: 'Primær platform',
      whyJoin: 'Hvorfor vil du blive affiliate?',
      submit: 'Send ansøgning',
      successTitle: 'Tak for din ansøgning!',
      successMessage: 'Vi gennemgår din ansøgning og vender tilbage inden for 24 timer.',
      faq: 'Ofte stillede spørgsmål',
      faqs: [
        { q: 'Hvor meget kan jeg tjene?', a: 'Det afhænger af din målgruppe. Vores bedste affiliates tjener flere tusinde kroner om måneden.' },
        { q: 'Hvornår får jeg min provision?', a: 'Du kan anmode om udbetaling når som helst direkte i dit dashboard.' },
        { q: 'Skal jeg betale skat?', a: 'Ja, du er ansvarlig for at indberette dine indtægter til skattemyndighederne.' },
        { q: 'Kan jeg være affiliate med få følgere?', a: 'Ja! Vi værdsætter engagement mere end antallet af følgere.' },
      ],
      selectPlatform: 'Vælg platform',
      selectCount: 'Vælg antal',
      other: 'Andet',
      errorSomethingWrong: 'Noget gik galt',
      seoTitle: 'Affiliate-program - Tjen penge',
      seoDescription: 'Tilmeld dig vores affiliate-program og tjen op til 15% provision på hvert salg.',
    },
    de: {
      badge: 'Affiliate-Programm',
      title: 'Verdiene Geld, indem du Produkte teilst, die du liebst',
      subtitle: 'Tritt unserem Affiliate-Programm bei und verdiene Provision für jeden Verkauf. Kein Startgeld, keine versteckten Kosten.',
      benefits: [
        { icon: DollarSign, title: 'Bis zu 15% Provision', desc: 'Verdiene bei jedem Verkauf, den du generierst' },
        { icon: Gift, title: '10% Rabatt für deine Follower', desc: 'Deine Follower erhalten Rabatt mit deinem Code' },
        { icon: Wallet, title: 'Flexible Auszahlungen', desc: 'Jederzeit auszahlen lassen' },
        { icon: TrendingUp, title: 'Echtzeit-Statistiken', desc: 'Verfolge deine Einnahmen im Dashboard' },
      ],
      howItWorks: 'So funktioniert es',
      steps: [
        { step: '1', title: 'Bewerben', desc: 'Fülle das Formular unten aus' },
        { step: '2', title: 'Genehmigt werden', desc: 'Wir prüfen deine Bewerbung innerhalb von 24h' },
        { step: '3', title: 'Teilen', desc: 'Erhalte deinen einzigartigen Code und fange an zu verdienen' },
        { step: '4', title: 'Verdienen', desc: 'Provision bei jedem Verkauf' },
      ],
      formTitle: 'Jetzt bewerben',
      formSubtitle: 'Fülle deine Daten aus und wir melden uns innerhalb von 24 Stunden',
      name: 'Name',
      email: 'E-Mail',
      phone: 'Telefon (optional)',
      socialMedia: 'Social-Media-Profil',
      followersCount: 'Anzahl der Follower',
      platform: 'Hauptplattform',
      whyJoin: 'Warum möchtest du Affiliate werden?',
      submit: 'Bewerbung absenden',
      successTitle: 'Danke für deine Bewerbung!',
      successMessage: 'Wir prüfen deine Bewerbung und melden uns innerhalb von 24 Stunden.',
      faq: 'Häufige Fragen',
      faqs: [
        { q: 'Wie viel kann ich verdienen?', a: 'Das hängt von deiner Zielgruppe ab. Unsere besten Affiliates verdienen mehrere tausend Kronen pro Monat.' },
        { q: 'Wann bekomme ich meine Provision?', a: 'Du kannst jederzeit direkt in deinem Dashboard eine Auszahlung beantragen.' },
        { q: 'Muss ich Steuern zahlen?', a: 'Ja, du bist dafür verantwortlich, deine Einnahmen den Steuerbehörden zu melden.' },
        { q: 'Kann ich Affiliate mit wenigen Followern sein?', a: 'Ja! Wir schätzen Engagement mehr als die Follower-Anzahl.' },
      ],
      selectPlatform: 'Plattform wählen',
      selectCount: 'Anzahl wählen',
      other: 'Sonstiges',
      errorSomethingWrong: 'Etwas ist schiefgelaufen',
      seoTitle: 'Affiliate-Programm - Geld verdienen',
      seoDescription: 'Tritt unserem Affiliate-Programm bei und verdiene bis zu 15% Provision für jeden Verkauf.',
    },
    fi: {
      badge: 'Affiliate-ohjelma',
      title: 'Ansaitse rahaa jakamalla tuotteita, joita rakastat',
      subtitle: 'Liity affiliate-ohjelmaanme ja ansaitse provisio jokaisesta myynnistä. Ei aloitusmaksua, ei piilokustannuksia.',
      benefits: [
        { icon: DollarSign, title: 'Jopa 15% provisio', desc: 'Ansaitse jokaisesta generoimastasi myynnistä' },
        { icon: Gift, title: '10% alennus seuraajillesi', desc: 'Seuraajasi saavat alennuksen koodillasi' },
        { icon: Wallet, title: 'Joustavat maksut', desc: 'Nosta milloin tahansa' },
        { icon: TrendingUp, title: 'Reaaliaikaiset tilastot', desc: 'Seuraa tulojasi hallintapaneelissa' },
      ],
      howItWorks: 'Näin se toimii',
      steps: [
        { step: '1', title: 'Hae', desc: 'Täytä alla oleva lomake' },
        { step: '2', title: 'Hyväksytään', desc: 'Käymme hakemuksesi läpi 24 tunnin sisällä' },
        { step: '3', title: 'Jaa', desc: 'Saa oma koodisi ja ala ansaita' },
        { step: '4', title: 'Ansaitse', desc: 'Provisio jokaisesta myynnistä' },
      ],
      formTitle: 'Hae nyt',
      formSubtitle: 'Täytä tietosi ja otamme yhteyttä 24 tunnin sisällä',
      name: 'Nimi',
      email: 'Sähköposti',
      phone: 'Puhelin (valinnainen)',
      socialMedia: 'Some-profiili',
      followersCount: 'Seuraajien määrä',
      platform: 'Pääalusta',
      whyJoin: 'Miksi haluat tulla affiliateksi?',
      submit: 'Lähetä hakemus',
      successTitle: 'Kiitos hakemuksestasi!',
      successMessage: 'Käymme hakemuksesi läpi ja otamme yhteyttä 24 tunnin sisällä.',
      faq: 'Usein kysytyt kysymykset',
      faqs: [
        { q: 'Kuinka paljon voin ansaita?', a: 'Se riippuu yleisöstäsi. Parhaat affiliatemme ansaitsevat useita tuhansia kruunuja kuukaudessa.' },
        { q: 'Milloin saan provision?', a: 'Voit pyytää maksua milloin tahansa suoraan hallintapaneelissasi.' },
        { q: 'Pitääkö minun maksaa veroja?', a: 'Kyllä, olet vastuussa tulojesi ilmoittamisesta veroviranomaisille.' },
        { q: 'Voinko olla affiliate, vaikka minulla on vähän seuraajia?', a: 'Kyllä! Arvostamme sitoutuneisuutta enemmän kuin seuraajamäärää.' },
      ],
      selectPlatform: 'Valitse alusta',
      selectCount: 'Valitse määrä',
      other: 'Muu',
      errorSomethingWrong: 'Jotain meni pieleen',
      seoTitle: 'Affiliate-ohjelma - Ansaitse rahaa',
      seoDescription: 'Liity affiliate-ohjelmaanme ja ansaitse jopa 15% provisio jokaisesta myynnistä.',
    },
    nl: {
      badge: 'Affiliate-programma',
      title: 'Verdien geld door producten te delen die je geweldig vindt',
      subtitle: 'Doe mee aan ons affiliate-programma en verdien commissie op elke verkoop. Geen startkosten, geen verborgen kosten.',
      benefits: [
        { icon: DollarSign, title: 'Tot 15% commissie', desc: 'Verdien op elke verkoop die je genereert' },
        { icon: Gift, title: '10% korting voor jouw volgers', desc: 'Jouw volgers krijgen korting met jouw code' },
        { icon: Wallet, title: 'Flexibele uitbetalingen', desc: 'Altijd opnemen wanneer je wil' },
        { icon: TrendingUp, title: 'Realtime statistieken', desc: 'Volg jouw inkomsten in je dashboard' },
      ],
      howItWorks: 'Hoe het werkt',
      steps: [
        { step: '1', title: 'Aanmelden', desc: 'Vul het formulier hieronder in' },
        { step: '2', title: 'Goedgekeurd worden', desc: 'We beoordelen je aanvraag binnen 24u' },
        { step: '3', title: 'Delen', desc: 'Ontvang jouw unieke code en begin te verdienen' },
        { step: '4', title: 'Verdienen', desc: 'Commissie op elke verkoop' },
      ],
      formTitle: 'Nu aanmelden',
      formSubtitle: 'Vul jouw gegevens in en we nemen binnen 24 uur contact op',
      name: 'Naam',
      email: 'E-mail',
      phone: 'Telefoon (optioneel)',
      socialMedia: 'Social media-profiel',
      followersCount: 'Aantal volgers',
      platform: 'Primair platform',
      whyJoin: 'Waarom wil je affiliate worden?',
      submit: 'Aanvraag indienen',
      successTitle: 'Bedankt voor je aanvraag!',
      successMessage: 'We beoordelen je aanvraag en nemen binnen 24 uur contact op.',
      faq: 'Veelgestelde vragen',
      faqs: [
        { q: 'Hoeveel kan ik verdienen?', a: 'Dat hangt af van jouw publiek. Onze beste affiliates verdienen meerdere duizenden kronen per maand.' },
        { q: 'Wanneer krijg ik mijn commissie?', a: 'Je kunt op elk moment een uitbetaling aanvragen, rechtstreeks in je dashboard.' },
        { q: 'Moet ik belasting betalen?', a: 'Ja, jij bent verantwoordelijk voor het opgeven van jouw inkomsten aan de belastingdienst.' },
        { q: 'Kan ik affiliate zijn met weinig volgers?', a: 'Ja! We waarderen betrokkenheid meer dan het aantal volgers.' },
      ],
      selectPlatform: 'Selecteer platform',
      selectCount: 'Selecteer aantal',
      other: 'Overig',
      errorSomethingWrong: 'Er is iets misgegaan',
      seoTitle: 'Affiliate-programma - Geld verdienen',
      seoDescription: 'Doe mee aan ons affiliate-programma en verdien tot 15% commissie op elke verkoop.',
    },
    fr: {
      badge: 'Programme d\'affiliation',
      title: 'Gagnez de l\'argent en partageant des produits que vous adorez',
      subtitle: 'Rejoignez notre programme d\'affiliation et gagnez une commission sur chaque vente. Aucun frais de départ, aucun frais caché.',
      benefits: [
        { icon: DollarSign, title: "Jusqu'à 15% de commission", desc: 'Gagnez sur chaque vente que vous générez' },
        { icon: Gift, title: '10% de réduction pour vos abonnés', desc: 'Vos abonnés bénéficient d\'une réduction avec votre code' },
        { icon: Wallet, title: 'Paiements flexibles', desc: 'Retirez à tout moment' },
        { icon: TrendingUp, title: 'Statistiques en temps réel', desc: 'Suivez vos revenus dans votre tableau de bord' },
      ],
      howItWorks: 'Comment ça marche',
      steps: [
        { step: '1', title: 'Postuler', desc: 'Remplissez le formulaire ci-dessous' },
        { step: '2', title: 'Être approuvé', desc: 'Nous examinons votre candidature sous 24h' },
        { step: '3', title: 'Partager', desc: 'Obtenez votre code unique et commencez à gagner' },
        { step: '4', title: 'Gagner', desc: 'Commission sur chaque vente' },
      ],
      formTitle: 'Postuler maintenant',
      formSubtitle: 'Remplissez vos coordonnées et nous vous répondrons sous 24 heures',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Téléphone (facultatif)',
      socialMedia: 'Profil réseau social',
      followersCount: 'Nombre d\'abonnés',
      platform: 'Plateforme principale',
      whyJoin: 'Pourquoi voulez-vous devenir affilié ?',
      submit: 'Soumettre la candidature',
      successTitle: 'Merci pour votre candidature !',
      successMessage: 'Nous examinerons votre candidature et vous répondrons sous 24 heures.',
      faq: 'Questions fréquentes',
      faqs: [
        { q: 'Combien puis-je gagner ?', a: "Cela dépend de votre audience. Nos meilleurs affiliés gagnent plusieurs milliers de couronnes par mois." },
        { q: 'Quand vais-je recevoir ma commission ?', a: 'Vous pouvez demander un paiement à tout moment directement dans votre tableau de bord.' },
        { q: 'Dois-je payer des impôts ?', a: 'Oui, vous êtes responsable de déclarer vos revenus aux autorités fiscales.' },
        { q: 'Puis-je être affilié avec peu d\'abonnés ?', a: "Oui ! Nous valorisons l'engagement plus que le nombre d'abonnés." },
      ],
      selectPlatform: 'Choisir une plateforme',
      selectCount: 'Choisir le nombre',
      other: 'Autre',
      errorSomethingWrong: 'Quelque chose a mal tourné',
      seoTitle: "Programme d'affiliation - Gagnez de l'argent",
      seoDescription: "Rejoignez notre programme d'affiliation et gagnez jusqu'à 15% de commission sur chaque vente.",
    },
    es: {
      badge: 'Programa de afiliados',
      title: 'Gana dinero compartiendo productos que amas',
      subtitle: 'Únete a nuestro programa de afiliados y gana comisión en cada venta. Sin tarifa de inicio, sin costos ocultos.',
      benefits: [
        { icon: DollarSign, title: 'Hasta un 15% de comisión', desc: 'Gana en cada venta que generes' },
        { icon: Gift, title: '10% de descuento para tus seguidores', desc: 'Tus seguidores obtienen descuento con tu código' },
        { icon: Wallet, title: 'Pagos flexibles', desc: 'Retira en cualquier momento' },
        { icon: TrendingUp, title: 'Estadísticas en tiempo real', desc: 'Sigue tus ingresos en tu panel' },
      ],
      howItWorks: 'Cómo funciona',
      steps: [
        { step: '1', title: 'Solicitar', desc: 'Rellena el formulario a continuación' },
        { step: '2', title: 'Ser aprobado', desc: 'Revisamos tu solicitud en 24h' },
        { step: '3', title: 'Compartir', desc: 'Obtén tu código único y empieza a ganar' },
        { step: '4', title: 'Ganar', desc: 'Comisión en cada venta' },
      ],
      formTitle: 'Solicitar ahora',
      formSubtitle: 'Rellena tus datos y te responderemos en 24 horas',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono (opcional)',
      socialMedia: 'Perfil en redes sociales',
      followersCount: 'Número de seguidores',
      platform: 'Plataforma principal',
      whyJoin: '¿Por qué quieres convertirte en afiliado?',
      submit: 'Enviar solicitud',
      successTitle: '¡Gracias por tu solicitud!',
      successMessage: 'Revisaremos tu solicitud y te responderemos en 24 horas.',
      faq: 'Preguntas frecuentes',
      faqs: [
        { q: '¿Cuánto puedo ganar?', a: 'Depende de tu audiencia. Nuestros mejores afiliados ganan varios miles de coronas al mes.' },
        { q: '¿Cuándo recibo mi comisión?', a: 'Puedes solicitar el pago en cualquier momento directamente en tu panel.' },
        { q: '¿Tengo que pagar impuestos?', a: 'Sí, eres responsable de declarar tus ingresos ante las autoridades fiscales.' },
        { q: '¿Puedo ser afiliado con pocos seguidores?', a: '¡Sí! Valoramos el compromiso más que el número de seguidores.' },
      ],
      selectPlatform: 'Seleccionar plataforma',
      selectCount: 'Seleccionar cantidad',
      other: 'Otro',
      errorSomethingWrong: 'Algo salió mal',
      seoTitle: 'Programa de afiliados - Gana dinero',
      seoDescription: 'Únete a nuestro programa de afiliados y gana hasta un 15% de comisión en cada venta.',
    },
    pl: {
      badge: 'Program afiliacyjny',
      title: 'Zarabiaj, dzieląc się produktami, które kochasz',
      subtitle: 'Dołącz do naszego programu afiliacyjnego i zarabiaj prowizję od każdej sprzedaży. Brak opłat startowych, brak ukrytych kosztów.',
      benefits: [
        { icon: DollarSign, title: 'Do 15% prowizji', desc: 'Zarabiaj na każdej wygenerowanej przez siebie sprzedaży' },
        { icon: Gift, title: '10% zniżki dla obserwujących', desc: 'Twoi obserwujący otrzymują zniżkę z Twoim kodem' },
        { icon: Wallet, title: 'Elastyczne wypłaty', desc: 'Wypłacaj w dowolnym momencie' },
        { icon: TrendingUp, title: 'Statystyki w czasie rzeczywistym', desc: 'Śledź swoje dochody w panelu' },
      ],
      howItWorks: 'Jak to działa',
      steps: [
        { step: '1', title: 'Aplikuj', desc: 'Wypełnij formularz poniżej' },
        { step: '2', title: 'Zatwierdź', desc: 'Rozpatrzymy Twoją aplikację w ciągu 24h' },
        { step: '3', title: 'Udostępniaj', desc: 'Otrzymaj swój unikalny kod i zacznij zarabiać' },
        { step: '4', title: 'Zarabiaj', desc: 'Prowizja od każdej sprzedaży' },
      ],
      formTitle: 'Aplikuj teraz',
      formSubtitle: 'Wypełnij swoje dane, a my skontaktujemy się w ciągu 24 godzin',
      name: 'Imię i nazwisko',
      email: 'E-mail',
      phone: 'Telefon (opcjonalnie)',
      socialMedia: 'Profil w mediach społecznościowych',
      followersCount: 'Liczba obserwujących',
      platform: 'Główna platforma',
      whyJoin: 'Dlaczego chcesz zostać afiliatem?',
      submit: 'Wyślij aplikację',
      successTitle: 'Dziękujemy za Twoją aplikację!',
      successMessage: 'Rozpatrzymy Twoją aplikację i skontaktujemy się w ciągu 24 godzin.',
      faq: 'Często zadawane pytania',
      faqs: [
        { q: 'Ile mogę zarobić?', a: 'To zależy od Twojej grupy docelowej. Nasi najlepsi afiliaci zarabiają kilka tysięcy koron miesięcznie.' },
        { q: 'Kiedy otrzymam prowizję?', a: 'Możesz poprosić o wypłatę w dowolnym momencie bezpośrednio w swoim panelu.' },
        { q: 'Czy muszę płacić podatki?', a: 'Tak, jesteś odpowiedzialny za zgłaszanie swoich dochodów organom podatkowym.' },
        { q: 'Czy mogę być afiliatem z małą liczbą obserwujących?', a: 'Tak! Cenimy zaangażowanie bardziej niż liczbę obserwujących.' },
      ],
      selectPlatform: 'Wybierz platformę',
      selectCount: 'Wybierz liczbę',
      other: 'Inne',
      errorSomethingWrong: 'Coś poszło nie tak',
      seoTitle: 'Program afiliacyjny - Zarabiaj',
      seoDescription: 'Dołącz do naszego programu afiliacyjnego i zarabiaj do 15% prowizji od każdej sprzedaży.',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('affiliate_applications')
        .insert({
          name: formData.name,
          email: formData.email.toLowerCase(),
          phone: formData.phone || null,
          social_media: formData.social_media,
          followers_count: formData.followers_count,
          platform: formData.platform,
          why_join: formData.why_join,
        });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit application:', error);
      toast.error(t.errorSomethingWrong);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.seoTitle}
        description={t.seoDescription}
        keywords="affiliate, partner, tjäna pengar, provision, influencer"
        canonical="/affiliate"
      />
      <Header />

      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="container mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium mb-6">
              <Share2 className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t.subtitle}
            </p>
          </motion.div>
        </section>

        {/* Benefits */}
        <section className="bg-secondary/30 py-16 mb-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="container mx-auto px-4 mb-20">
          <h2 className="font-display text-3xl font-semibold text-center mb-12">
            {t.howItWorks}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {t.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl">
                  {step.step}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Application Form */}
        <section className="container mx-auto px-4 mb-20">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-2">{t.successTitle}</h3>
                  <p className="text-muted-foreground">{t.successMessage}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-display text-2xl font-semibold mb-2">{t.formTitle}</h2>
                    <p className="text-muted-foreground">{t.formSubtitle}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t.name} *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t.email} *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">{t.phone}</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="social_media">{t.socialMedia} *</Label>
                        <Input
                          id="social_media"
                          placeholder="@username"
                          value={formData.social_media}
                          onChange={(e) => setFormData({ ...formData, social_media: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="platform">{t.platform} *</Label>
                        <Select
                          value={formData.platform}
                          onValueChange={(value) => setFormData({ ...formData, platform: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t.selectPlatform} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="blog">Blog</SelectItem>
                            <SelectItem value="other">{t.other}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="followers_count">{t.followersCount} *</Label>
                        <Select
                          value={formData.followers_count}
                          onValueChange={(value) => setFormData({ ...formData, followers_count: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t.selectCount} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1000">0 - 1,000</SelectItem>
                            <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                            <SelectItem value="5000-10000">5,000 - 10,000</SelectItem>
                            <SelectItem value="10000-50000">10,000 - 50,000</SelectItem>
                            <SelectItem value="50000+">50,000+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="why_join">{t.whyJoin} *</Label>
                      <Textarea
                        id="why_join"
                        value={formData.why_join}
                        onChange={(e) => setFormData({ ...formData, why_join: e.target.value })}
                        rows={4}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      disabled={isSubmitting || !formData.platform || !formData.followers_count}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {t.submit}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-semibold text-center mb-12">{t.faq}</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {t.faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AffiliateLanding;