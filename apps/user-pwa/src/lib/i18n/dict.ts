/**
 * AutoGTG — i18n dictionary (V0).
 *
 * Lightweight in-house i18n: a flat key/value object per locale, with
 * `{var}` interpolation. EN is the source of truth; UR provides
 * translations for highly-visible strings only in V0. Missing UR keys
 * fall back to EN.
 *
 * When backend lands and copy is finalized, this becomes the seed for
 * `messages/en.json` and `messages/ur.json` consumed by next-intl.
 */

export type Locale = "en" | "ur";

export const LOCALES: Locale[] = ["en", "ur"];

/* ----------- EN ----------- */
const en = {
  /* TopBar / brand */
  "brand.name": "AutoGTG",
  "lang.toggleAria": "Switch language",

  /* TabBar */
  "tab.home": "Home",
  "tab.bookings": "Bookings",
  "tab.profile": "Profile",

  /* Home — greeting + buckets */
  "home.greeting.guest": "Hi there 👋",
  "home.greeting.user": "Hi {name} 👋",
  "home.subgreeting": "What do you need today?",
  "home.pickService": "Pick a service",
  "home.recent": "Recent bookings",
  "home.seeAll": "See all →",

  "bucket.repairs.label": "Repairs",
  "bucket.repairs.blurb": "Engine, brakes, more",
  "bucket.detailing.label": "Detailing",
  "bucket.detailing.blurb": "Wash, polish, ceramic",
  "bucket.denting.label": "Denting & Painting",
  "bucket.denting.blurb": "Dents, scratches, full repaint",

  /* Trust cards */
  "trust.money": "Your money is held safely until your job is complete.",
  "trust.vetted": "Every garage in our network is checked in person before joining.",
  "trust.privacy": "Talk to your mechanic without sharing your phone number.",

  /* Active job bar */
  "active.label": "Active",
  "active.with": "With {name}",
  "active.inProgress": "in progress",
  "active.track": "Track",

  /* Login */
  "login.almostDone": "Almost done.",
  "login.askPhone": "What's your phone number?",
  "login.viaWhatsapp": "We'll send a 6-digit code via WhatsApp.",
  "login.viaSms": "We'll send a 6-digit code via SMS.",
  "login.sendCode": "Send code",
  "login.sending": "Sending…",
  "login.checkWhatsapp": "Check WhatsApp.",
  "login.checkSms": "Check your messages.",
  "login.codeSentTo": "We sent a 6-digit code to",
  "login.change": "Change",
  "login.resend": "Resend code",
  "login.trySms": "Try SMS instead",
  "login.tryWhatsapp": "Try WhatsApp instead",
  "login.wrongCode": "Wrong code. Try again.",
  "login.verifying": "Verifying…",
  "login.terms":
    "By continuing, you agree to our Terms and Privacy.",

  /* Status pills */
  "status.queued_for_call": "Awaiting call",
  "status.quoted": "Quote ready",
  "status.awaiting_garage": "Finding garage",
  "status.assigned": "Booked",
  "status.in_progress": "In progress",
  "status.completed": "Completed",
  "status.cancelled": "Cancelled",
  "status.declined_by_garage": "Reassigning",

  /* CTA verbs */
  "cta.continue": "Continue",
  "cta.continueToPay": "Continue to pay",
  "cta.confirmAndPay": "Confirm & pay",
  "cta.confirmBooking": "Confirm booking",
  "cta.bookGarage": "Book this garage",
  "cta.signIn": "Sign in",
  "cta.signOut": "Sign out",
  "cta.cancel": "Cancel",
  "cta.save": "Save",
  "cta.edit": "Edit",
  "cta.retry": "Retry",
  "cta.getDirections": "Get directions",
  "cta.callViaMW": "Call {name} via AutoGTG",

  /* Pay */
  "pay.howWillYouPay": "How will you pay?",
  "pay.total": "Total",
  "pay.upi": "Pay with UPI",
  "pay.upiSubtitle": "Cards / netbanking also work",
  "pay.cash": "Pay cash at the garage",
  "pay.cashSubtitle": "When the job is done",
  "pay.recommended": "Recommended ✨",
  "pay.held": "Held safely",
  "pay.heldFull": "Held safely until your job is complete.",
  "pay.cashNote":
    "You'll pay {amount} cash directly to your garage when the job is done.",
  "pay.freeCancel": "Free to cancel until 1 hour before your slot.",
  "pay.afterInspection": "After inspection",

  /* Confirmation */
  "conf.confirmed": "Booking confirmed",
  "conf.privacyNote": "Your number stays private.",
  "conf.helpWhatsapp": "WhatsApp us (need help?)",
  "conf.bookingId": "Booking ID: {id}",
  "conf.paid": "Paid: {amount} via UPI",
  "conf.cashPending": "Pay {amount} cash on completion",
  "conf.trackBooking": "Track this booking →",

  /* Garage list / detail */
  "garage.pickGarage": "Pick a garage",
  "garage.pickFor.repairs": "Pick a garage for repairs",
  "garage.pickFor.detailing": "Pick a garage for detailing",
  "garage.pickFor.denting": "Pick a garage for denting",
  "garage.showing": "Showing {n} garages near you",
  "garage.showingOne": "Showing 1 garage near you",
  "garage.sort": "Sort:",
  "garage.sort.soonest": "Soonest available",
  "garage.sort.nearest": "Closest to me",
  "garage.sort.rating": "Highest rated",
  "garage.sortByTitle": "Sort garages by",
  "garage.empty.title": "No garages available right now",
  "garage.empty.body": "Try a different time, or WhatsApp us for help.",
  "garage.earliest": "Earliest: {slot}",
  "garage.jobsDone": "{n} jobs done",
  "garage.jobsDoneCapped": "100+ jobs done",
  "garage.new": "New on AutoGTG",
  "garage.new.badge": "New",

  /* Profile */
  "profile.signedOut.title": "Sign in to see your profile",
  "profile.signedOut.body": "We'll save your bookings and language preference here.",
  "profile.account": "Account",
  "profile.support": "Support",
  "profile.name": "Name",
  "profile.phone": "Phone",
  "profile.language": "Language",
  "profile.whatsappUs": "WhatsApp us",
  "profile.faq": "FAQ",
  "profile.namePrompt.title": "Your name",
  "profile.namePrompt.body": "What should we call you?",
  "profile.namePrompt.placeholder": "e.g. Imran",

  /* Bookings */
  "bookings.title": "Your bookings",
  "bookings.signedOut.title": "Sign in to see your bookings",
  "bookings.signedOut.body": "We'll show your active and past bookings here.",
  "bookings.empty.title": "No bookings yet",
  "bookings.empty.body": "Book your first service from the home tab.",
  "bookings.goHome": "Go to home →",

  /* Detailing catalog */
  "detailing.title": "Pick the services you need.",
  "detailing.subtitle": "Multi-select. Total updates as you go.",
  "detailing.pickAtLeast": "Pick at least one service",
  "detailing.servicesCount": "{n} services",
  "detailing.servicesCountOne": "1 service",

  /* Repairs */
  "repairs.q1.title": "What's wrong?",
  "repairs.q1.body": "Pick the area you're worried about.",
  "repairs.q2.title": "Show me the symptom.",
  "repairs.q2.body": "Closest match works — pick \"I don't know\" if unsure.",
  "repairs.q3.title": "How long has it been happening?",
  "repairs.skipDiagnose": "Skip — let the garage diagnose →",
  "repairs.estimate.title": "Estimated price",
  "repairs.estimate.likelyNeeded": "Likely needed",
  "repairs.estimate.basedOn": "Based on average prices for this issue across nearby garages.",
  "repairs.estimate.finalAfter":
    "Final price set after inspection. Garage may quote less or more depending on what they find.",
  "repairs.estimate.noMatch.title": "Garage will inspect",
  "repairs.estimate.noMatch.body": "No estimate yet for this one.",
  "repairs.estimate.noMatch.sub":
    "Pick a garage, drop in, and the mechanic will quote after a look.",
  "repairs.estimate.reanswer": "← Re-answer the symptom form",
  "repairs.estimate.pickGarage": "Pick a garage ›",

  /* Denting */
  "denting.title": "Show us the damage.",
  "denting.subtitle":
    "We'll send your photos to up to 3 nearby body shops. Quotes back via WhatsApp within 24 hours.",
  "denting.describe": "Describe what happened",
  "denting.descPlaceholder": "e.g. Hit a pole on driver side, dented the door.",
  "denting.photos": "Photos (1–6)",
  "denting.panels": "Panels affected (optional)",
  "denting.send": "Send to garages ›",
  "denting.signInAndSend": "Sign in & send ›",
  "denting.quotes.waiting.title": "Sending to garages…",
  "denting.quotes.waiting.body":
    "Quotes typically arrive within 24 hours. We'll WhatsApp you when ready.",
  "denting.quotes.waitingDot": "Waiting…",
  "denting.quotes.received": "{n} quotes received",
  "denting.quotes.receivedOne": "1 quote received",
  "denting.quotes.sub":
    "Compare and pick. You'll pay 30% advance now, 70% after the job.",
  "denting.quotes.continue": "Continue with this quote ›",

  /* Slot picker */
  "slot.title": "Pick a slot",
  "slot.with": "With {name} · {area}",
  "slot.pickATime": "Pick a time",
  "slot.label": "Slot",

  /* Review */
  "review.title": "Review your booking",
  "review.section.services": "Services",
  "review.section.garage": "Garage",
  "review.section.slot": "Slot",
  "review.section.total": "Total",
  "review.priceAfterInspection": "Repairs — price after garage inspection.",
  "review.dentingQuote": "Denting & painting — quote after photos.",
  "review.finalPriceByGarage": "Final price will be set by the garage.",

  /* Tracking */
  "track.title": "Track booking",
  "track.assigned": "Booked & confirmed",
  "track.inProgress": "Job in progress",
  "track.completed": "Job completed",
  "track.cancelled": "Booking cancelled",
  "track.helperAssigned": "You'll get a WhatsApp ping when {name} starts the job.",
  "track.helperInProgress": "{name} is working on your car right now.",
  "track.helperCompletedThanks": "Thanks for rating! You gave {n}★.",
  "track.helperCompletedRate":
    "Tell us how it went — your rating helps other users.",
  "track.helperCancelled": "This booking was cancelled.",
  "track.rate": "Rate {name}",
  "track.demoControls": "Demo controls",
  "track.demoControlsBody":
    "These exist for the V0 demo only. With backend wired, the garage drives status.",
  "track.markInProgress": "Mark as in progress",
  "track.markCompleted": "Mark as completed",
  "track.cancel": "Cancel booking",
  "track.cancelTitle": "Cancel this booking?",
  "track.cancelBody": "Free to cancel up to 1 hour before your slot.",
  "track.cancelYes": "Yes, cancel booking",
  "track.cancelKeep": "Keep booking",
  "track.rateTitle": "How was {name}?",
  "track.rateTap": "Tap to rate",
  "track.rateSubmit": "Submit rating",
  "track.reasonTitle": "What went wrong?",
  "track.reasonBody": "Helps us decide which garages to keep.",
  "track.reasons.quality": "Quality was bad",
  "track.reasons.time": "Took too long",
  "track.reasons.price": "Was overcharged",
  "track.reasons.behaviour": "Behaviour issue",
  "track.reasons.sideline": "Tried to take work outside the app",
  "track.reasons.other": "Other",
  "track.reasonDone": "Done",

  /* Misc */
  "common.notFound": "Booking not found",
  "common.backToHome": "Back to home",
  "common.backToBookings": "Back to bookings",
} as const;

type Key = keyof typeof en;

/* ----------- UR (Urdu) ----------- */
const ur: Partial<Record<Key, string>> = {
  "brand.name": "AutoGTG",
  "lang.toggleAria": "زبان تبدیل کریں",

  "tab.home": "ہوم",
  "tab.bookings": "بکنگز",
  "tab.profile": "پروفائل",

  "home.greeting.guest": "السلام علیکم 👋",
  "home.greeting.user": "السلام علیکم {name} 👋",
  "home.subgreeting": "آج آپ کو کیا چاہیے؟",
  "home.pickService": "خدمت چنیں",
  "home.recent": "حالیہ بکنگز",
  "home.seeAll": "سب دیکھیں ←",

  "bucket.repairs.label": "مرمت",
  "bucket.repairs.blurb": "انجن، بریک اور بہت کچھ",
  "bucket.detailing.label": "ڈیٹیلنگ",
  "bucket.detailing.blurb": "دھلائی، پالش، سرامک",
  "bucket.denting.label": "ڈینٹنگ اور پینٹنگ",
  "bucket.denting.blurb": "ڈینٹ، خراشیں، مکمل پینٹ",

  "trust.money": "آپ کا کام مکمل ہونے تک رقم محفوظ ہے۔",
  "trust.vetted":
    "ہمارے نیٹ ورک میں شامل ہر گیراج کو ذاتی طور پر چیک کیا جاتا ہے۔",
  "trust.privacy": "اپنا فون نمبر شیئر کیے بغیر مکینک سے بات کریں۔",

  "active.label": "فعال",
  "active.with": "{name} کے ساتھ",
  "active.inProgress": "جاری",
  "active.track": "ٹریک",

  "login.almostDone": "بس تھوڑا سا اور۔",
  "login.askPhone": "آپ کا فون نمبر کیا ہے؟",
  "login.viaWhatsapp": "ہم 6 ہندسوں کا کوڈ واٹس ایپ پر بھیجیں گے۔",
  "login.viaSms": "ہم 6 ہندسوں کا کوڈ ایس ایم ایس پر بھیجیں گے۔",
  "login.sendCode": "کوڈ بھیجیں",
  "login.sending": "بھیجا جا رہا ہے…",
  "login.checkWhatsapp": "واٹس ایپ دیکھیں۔",
  "login.checkSms": "اپنے میسجز دیکھیں۔",
  "login.codeSentTo": "ہم نے اس نمبر پر 6 ہندسوں کا کوڈ بھیجا ہے",
  "login.change": "تبدیل کریں",
  "login.resend": "کوڈ دوبارہ بھیجیں",
  "login.trySms": "ایس ایم ایس آزمائیں",
  "login.tryWhatsapp": "واٹس ایپ آزمائیں",
  "login.wrongCode": "غلط کوڈ۔ دوبارہ کوشش کریں۔",
  "login.verifying": "تصدیق ہو رہی ہے…",
  "login.terms":
    "جاری رکھ کر آپ ہماری شرائط اور پرائیویسی پالیسی سے اتفاق کرتے ہیں۔",

  "status.queued_for_call": "کال کا انتظار",
  "status.quoted": "قیمت تیار",
  "status.awaiting_garage": "گیراج کی تلاش",
  "status.assigned": "بُک کی گئی",
  "status.in_progress": "جاری",
  "status.completed": "مکمل",
  "status.cancelled": "منسوخ",
  "status.declined_by_garage": "دوبارہ مقرر",

  "cta.continue": "جاری رکھیں",
  "cta.continueToPay": "ادائیگی کیلئے آگے بڑھیں",
  "cta.confirmAndPay": "تصدیق کریں اور ادا کریں",
  "cta.confirmBooking": "بکنگ کی تصدیق کریں",
  "cta.bookGarage": "اس گیراج پر بُک کریں",
  "cta.signIn": "سائن اِن",
  "cta.signOut": "سائن آؤٹ",
  "cta.cancel": "منسوخ",
  "cta.save": "محفوظ کریں",
  "cta.edit": "ترمیم",
  "cta.retry": "دوبارہ کوشش",
  "cta.getDirections": "راستہ دیکھیں",
  "cta.callViaMW": "{name} کو AutoGTG کے ذریعے کال کریں",

  "pay.howWillYouPay": "ادائیگی کیسے کریں گے؟",
  "pay.total": "کل",
  "pay.upi": "UPI سے ادائیگی",
  "pay.upiSubtitle": "کارڈز اور نیٹ بینکنگ بھی",
  "pay.cash": "گیراج پر نقد ادائیگی",
  "pay.cashSubtitle": "جب کام مکمل ہو",
  "pay.recommended": "تجویز کردہ ✨",
  "pay.held": "محفوظ",
  "pay.heldFull": "آپ کا کام مکمل ہونے تک رقم محفوظ ہے۔",
  "pay.cashNote":
    "آپ {amount} اپنے گیراج کو کام مکمل ہونے پر نقد ادا کریں گے۔",
  "pay.freeCancel": "اپنے سلاٹ سے 1 گھنٹہ پہلے تک منسوخ کرنا مفت ہے۔",
  "pay.afterInspection": "معائنے کے بعد",

  "conf.confirmed": "بکنگ کی تصدیق ہوگئی",
  "conf.privacyNote": "آپ کا نمبر پرائیویٹ رہتا ہے۔",
  "conf.helpWhatsapp": "ہمیں واٹس ایپ کریں (مدد چاہیے؟)",
  "conf.bookingId": "بکنگ آئی ڈی: {id}",
  "conf.paid": "ادا کی گئی: {amount} UPI سے",
  "conf.cashPending": "کام مکمل ہونے پر {amount} نقد ادا کریں",
  "conf.trackBooking": "اس بکنگ کو ٹریک کریں ←",

  "garage.pickGarage": "گیراج چنیں",
  "garage.pickFor.repairs": "مرمت کیلئے گیراج چنیں",
  "garage.pickFor.detailing": "ڈیٹیلنگ کیلئے گیراج چنیں",
  "garage.pickFor.denting": "ڈینٹنگ کیلئے گیراج چنیں",
  "garage.sort": "ترتیب:",
  "garage.sort.soonest": "جلد دستیاب",
  "garage.sort.nearest": "میرے قریب",
  "garage.sort.rating": "اعلیٰ درجہ",
  "garage.sortByTitle": "گیراجز کو ترتیب دیں",
  "garage.empty.title": "اس وقت کوئی گیراج دستیاب نہیں",
  "garage.empty.body": "کوئی اور وقت آزمائیں، یا مدد کیلئے واٹس ایپ کریں۔",
  "garage.new": "AutoGTG پر نیا",
  "garage.new.badge": "نیا",

  "profile.signedOut.title": "اپنا پروفائل دیکھنے کیلئے سائن اِن کریں",
  "profile.signedOut.body":
    "ہم آپ کی بکنگز اور زبان کی ترجیح یہاں محفوظ رکھیں گے۔",
  "profile.account": "اکاؤنٹ",
  "profile.support": "مدد",
  "profile.name": "نام",
  "profile.phone": "فون",
  "profile.language": "زبان",
  "profile.whatsappUs": "ہمیں واٹس ایپ کریں",
  "profile.faq": "اکثر پوچھے جانے والے سوالات",
  "profile.namePrompt.title": "آپ کا نام",
  "profile.namePrompt.body": "ہم آپ کو کیا کہیں؟",
  "profile.namePrompt.placeholder": "مثلاً عمران",

  "bookings.title": "آپ کی بکنگز",
  "bookings.signedOut.title": "اپنی بکنگز دیکھنے کیلئے سائن اِن کریں",
  "bookings.signedOut.body":
    "ہم یہاں آپ کی فعال اور سابقہ بکنگز دکھائیں گے۔",
  "bookings.empty.title": "ابھی کوئی بکنگ نہیں",
  "bookings.empty.body": "ہوم ٹیب سے اپنی پہلی خدمت بُک کریں۔",
  "bookings.goHome": "ہوم پر جائیں ←",

  "detailing.title": "اپنی مطلوبہ خدمات چنیں۔",
  "detailing.subtitle": "ایک سے زائد منتخب کریں۔ کل خود بخود اپڈیٹ ہوگا۔",
  "detailing.pickAtLeast": "کم از کم ایک خدمت چنیں",

  "repairs.q1.title": "کیا مسئلہ ہے؟",
  "repairs.q1.body": "وہ حصہ چنیں جس میں مسئلہ ہے۔",
  "repairs.q2.title": "علامت دکھائیں۔",
  "repairs.q2.body":
    "قریبی میچ بھی چلے گا — اگر یقین نہ ہو تو 'مجھے نہیں معلوم' چنیں۔",
  "repairs.q3.title": "یہ کب سے ہو رہا ہے؟",

  "denting.title": "نقصان دکھائیں۔",
  "denting.send": "گیراجز کو بھیجیں ←",
  "denting.signInAndSend": "سائن اِن کر کے بھیجیں ←",

  "track.title": "بکنگ ٹریک کریں",
  "track.assigned": "بُک اور تصدیق شدہ",
  "track.inProgress": "کام جاری",
  "track.completed": "کام مکمل",
  "track.cancelled": "بکنگ منسوخ",

  "common.notFound": "بکنگ نہیں ملی",
  "common.backToHome": "ہوم پر واپس",
};

/* ----------- Translator ----------- */

const dictionaries: Record<Locale, Partial<Record<Key, string>>> = {
  en,
  ur,
};

export function t(
  locale: Locale,
  key: Key,
  vars?: Record<string, string | number>,
): string {
  let s = dictionaries[locale]?.[key] ?? en[key] ?? (key as string);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

export type DictKey = Key;
