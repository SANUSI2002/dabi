// Each screen template owns a distinct generated illustration and safe navigation action.
export const patientBanners = [
  {
    "id": "overview",
    "route": "dashboard",
    "title": "Your health, beautifully connected.",
    "description": "A calmer place to manage your care, see your next steps and stay connected.",
    "action": "View my appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian woman relaxing at home with a tablet and a leafy plant",
    "audience": "patient"
  },
  {
    "id": "appointments",
    "route": "appointments",
    "title": "Make time for your health.",
    "description": "Keep your visits organised and find the right care for your day.",
    "action": "Find a doctor",
    "to": "/doctor",
    "scene": "a Black Nigerian woman writing in an open blank weekly planner at a sunlit table",
    "audience": "patient"
  },
  {
    "id": "reschedule",
    "route": "appointments/reschedule/:id",
    "title": "A time that works for you.",
    "description": "Review your appointment and select a suitable available time.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian man looking at a wristwatch beside a blank desk calendar",
    "audience": "patient"
  },
  {
    "id": "records",
    "route": "records",
    "title": "Your story. Your care.",
    "description": "Keep your health documents organised and share them only when you choose.",
    "action": "View my prescriptions",
    "to": "/prescriptions",
    "scene": "a Black Nigerian woman organising plain unlabelled folders in an elegant study",
    "audience": "patient"
  },
  {
    "id": "prescriptions",
    "route": "prescriptions",
    "title": "Clarity in every prescription.",
    "description": "Review the treatments shared by your care team and choose your next step.",
    "action": "Explore pharmacies",
    "to": "/pharmacy-market",
    "scene": "a Black Nigerian pharmacist discussing an unlabelled prescription with an adult patient",
    "audience": "patient"
  },
  {
    "id": "prescription-detail",
    "route": "prescriptions/:id",
    "title": "Know your next step.",
    "description": "Review the details of this prescription before requesting medicines.",
    "action": "All prescriptions",
    "to": "/prescriptions",
    "scene": "close-up of calm hands holding a blank prescription beside an unlabelled medicine box",
    "audience": "patient"
  },
  {
    "id": "select-pharmacy",
    "route": "prescriptions/:id/select-pharmacy",
    "title": "Choose where your care continues.",
    "description": "Compare pharmacy options for your prescription.",
    "action": "Browse pharmacies",
    "to": "/pharmacy-market",
    "scene": "a welcoming neighbourhood pharmacy entrance with a Black Nigerian pharmacist",
    "audience": "patient"
  },
  {
    "id": "prescription-quotes",
    "route": "prescriptions/:id/quotes",
    "title": "Your choices, clearly presented.",
    "description": "Review pharmacy responses before deciding what works for you.",
    "action": "Quote inbox",
    "to": "/pharmacy-quotes",
    "scene": "hands comparing two blank stationery cards on a sage desktop with medicine packaging",
    "audience": "patient"
  },
  {
    "id": "dietician",
    "route": "prescriptions/dietician-table",
    "title": "Good nourishment. Thoughtful guidance.",
    "description": "Explore the nutrition plans shared by your professional.",
    "action": "Find a nutrition professional",
    "to": "/wellness-hub/professionals",
    "scene": "a Black Nigerian dietitian arranging a colourful wholesome meal of vegetables grains and beans",
    "audience": "patient"
  },
  {
    "id": "care-plans",
    "route": "care-plans",
    "title": "Small steps. Meaningful progress.",
    "description": "Keep the support goals agreed with your professional in view.",
    "action": "Explore wellness care",
    "to": "/wellness-hub",
    "scene": "a Black Nigerian adult reflecting in a blank journal in a peaceful garden",
    "audience": "patient"
  },
  {
    "id": "vitals",
    "route": "vitals",
    "title": "Know your rhythm.",
    "description": "Record your readings and keep track of changes over time.",
    "action": "Add a reading",
    "to": "/vitals/add",
    "scene": "a Black Nigerian woman checking a home blood-pressure cuff with no visible display numbers",
    "audience": "patient"
  },
  {
    "id": "vital-select",
    "route": "vitals/add",
    "title": "A moment to check in.",
    "description": "Choose the measurement you want to record.",
    "action": "View my vitals",
    "to": "/vitals",
    "scene": "a tabletop arrangement of simple unlabelled home health measurement devices",
    "audience": "patient"
  },
  {
    "id": "vital-reading",
    "route": "vitals/add/:type",
    "title": "Every reading tells a story.",
    "description": "Enter the measurement from your device carefully.",
    "action": "Choose another measurement",
    "to": "/vitals/add",
    "scene": "close-up of a Black Nigerian adult noting a device reading in a blank notebook",
    "audience": "patient"
  },
  {
    "id": "vital-history",
    "route": "vitals/history/:type",
    "title": "See the bigger picture.",
    "description": "Review your measurement history alongside your care team's advice.",
    "action": "My vitals",
    "to": "/vitals",
    "scene": "a Black Nigerian woman thoughtfully reviewing a tablet beside a plain notebook and home monitor",
    "audience": "patient"
  },
  {
    "id": "find-doctor",
    "route": "doctor",
    "title": "The right care starts here.",
    "description": "Find a healthcare professional and choose a consultation that fits.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "two Black Nigerian doctors in an airy clinic warmly conversing, without name badges",
    "audience": "patient"
  },
  {
    "id": "consultation-report",
    "route": "reports/:id",
    "title": "Care you can return to.",
    "description": "Revisit the notes and guidance shared after your consultation.",
    "action": "Health records",
    "to": "/records",
    "scene": "a Black Nigerian patient reading a plain care-summary booklet beside a sunlit window",
    "audience": "patient"
  },
  {
    "id": "profile",
    "route": "profile",
    "title": "Care starts with you.",
    "description": "Keep your personal details and care preferences up to date.",
    "action": "Health records",
    "to": "/records",
    "scene": "a Black Nigerian woman at a mirror in a bright minimal interior with a small plant",
    "audience": "patient"
  },
  {
    "id": "family",
    "route": "family",
    "title": "Looking after each other.",
    "description": "Organise your family's care while keeping each person's information separate.",
    "action": "Add a family member",
    "to": "/family/add",
    "scene": "a multigenerational Black Nigerian family spending a calm afternoon together",
    "audience": "patient"
  },
  {
    "id": "family-add",
    "route": "family/add",
    "title": "Bring your circle closer.",
    "description": "Add or join a family-care relationship with the right permissions.",
    "action": "Family care",
    "to": "/family",
    "scene": "a Black Nigerian mother and adult daughter talking together at a kitchen table",
    "audience": "patient"
  },
  {
    "id": "dependent",
    "route": "family/add/dependent",
    "title": "Thoughtful care for your dependants.",
    "description": "Set up a separate profile for the person you care for.",
    "action": "Family care",
    "to": "/family",
    "scene": "a Black Nigerian parent and young child seated together in a calm waiting room",
    "audience": "patient"
  },
  {
    "id": "family-added",
    "route": "family/add/success",
    "title": "Your care circle, connected.",
    "description": "Continue managing the family relationships available to your account.",
    "action": "Family care",
    "to": "/family",
    "scene": "a Black Nigerian family holding hands in a sunny garden",
    "audience": "patient"
  },
  {
    "id": "family-member",
    "route": "family/member/:memberId",
    "title": "Their care, considered.",
    "description": "Review this family member's care within your permissions.",
    "action": "Family care",
    "to": "/family",
    "scene": "a Black Nigerian older adult and younger relative sharing tea on a veranda",
    "audience": "patient"
  },
  {
    "id": "care-calendar",
    "route": "family/care-calendar",
    "title": "A little more organised, together.",
    "description": "Keep family appointments and care routines in one place.",
    "action": "Family care",
    "to": "/family",
    "scene": "a Black Nigerian family planning their week around a blank calendar",
    "audience": "patient"
  },
  {
    "id": "family-hospital",
    "route": "family/hospital-enrollment",
    "title": "Coordinate care for your family.",
    "description": "Review hospital enrollment options for your care subjects.",
    "action": "Browse hospitals",
    "to": "/hospitals",
    "scene": "a Black Nigerian family greeted by a hospital receptionist",
    "audience": "patient"
  },
  {
    "id": "marketplace",
    "route": "pharmacy-market",
    "title": "Everyday care, thoughtfully supplied.",
    "description": "Discover pharmacy storefronts and review what is available.",
    "action": "My prescriptions",
    "to": "/prescriptions",
    "scene": "a Black Nigerian pharmacist arranging unbranded medicine cartons on warm wooden shelves",
    "audience": "patient"
  },
  {
    "id": "storefront",
    "route": "pharmacy-market/:pharmacyId",
    "title": "Care from your chosen pharmacy.",
    "description": "Explore the items and fulfilment options offered by this pharmacy.",
    "action": "All pharmacies",
    "to": "/pharmacy-market",
    "scene": "a Black Nigerian pharmacy owner at a welcoming counter with unlabelled packages",
    "audience": "patient"
  },
  {
    "id": "medicine-prescription",
    "route": "pharmacy-market/prescription",
    "title": "Start with your prescription.",
    "description": "Use your prescribed medicines to guide your pharmacy request.",
    "action": "My prescriptions",
    "to": "/prescriptions",
    "scene": "a paper prescription with no writing beside an unlabelled medicine package and reading glasses",
    "audience": "patient"
  },
  {
    "id": "refill",
    "route": "pharmacy-market/refill",
    "title": "Keep your routine in view.",
    "description": "Review your prescription before requesting a refill.",
    "action": "My prescriptions",
    "to": "/prescriptions",
    "scene": "a Black Nigerian adult organising a neutral weekly pill organiser without labels",
    "audience": "patient"
  },
  {
    "id": "repeat-order",
    "route": "pharmacy-market/repeat-last-order",
    "title": "A familiar order, carefully reviewed.",
    "description": "Check your previous order before placing another request.",
    "action": "Quote inbox",
    "to": "/pharmacy-quotes",
    "scene": "a Black Nigerian adult reviewing a small unlabelled pharmacy parcel at home",
    "audience": "patient"
  },
  {
    "id": "emergency-meds",
    "route": "pharmacy-market/emergency-meds",
    "title": "Find the supplies you need.",
    "description": "Browse availability; this marketplace is not an emergency-care service.",
    "action": "Browse pharmacies",
    "to": "/pharmacy-market",
    "scene": "a neatly arranged unbranded first-aid pouch and medicine packages on a calm sage table",
    "audience": "patient"
  },
  {
    "id": "quotes",
    "route": "pharmacy-quotes",
    "title": "Consider your options.",
    "description": "Review pharmacy quotes and choose your next step.",
    "action": "Browse pharmacies",
    "to": "/pharmacy-market",
    "scene": "a Black Nigerian woman comparing simple blank cards beside an unbranded pharmacy bag",
    "audience": "patient"
  },
  {
    "id": "deliveries",
    "route": "delivery-tracking",
    "title": "Follow your care delivery.",
    "description": "Track the delivery updates available for your orders.",
    "action": "Browse pharmacies",
    "to": "/pharmacy-market",
    "scene": "a Black Nigerian delivery professional carrying a plain paper pharmacy parcel",
    "audience": "patient"
  },
  {
    "id": "delivery-detail",
    "route": "delivery-tracking/:orderId",
    "title": "Your order, on its journey.",
    "description": "Review the latest available status for this delivery.",
    "action": "All deliveries",
    "to": "/delivery-tracking",
    "scene": "a small unbranded sealed care parcel on a doorstep with a leafy plant",
    "audience": "patient"
  },
  {
    "id": "cart",
    "route": "cart",
    "title": "A thoughtful basket.",
    "description": "Review your selected items before continuing.",
    "action": "Continue shopping",
    "to": "/pharmacy-market",
    "scene": "a woven basket with unbranded health-care packages in a light home setting",
    "audience": "patient"
  },
  {
    "id": "checkout",
    "route": "checkout",
    "title": "Review before you continue.",
    "description": "Check the items, delivery details and available payment options.",
    "action": "Review basket",
    "to": "/cart",
    "scene": "a Black Nigerian adult carefully checking a plain care parcel and blank order sheet",
    "audience": "patient"
  },
  {
    "id": "order-confirmation",
    "route": "order-confirmation",
    "title": "Your order at a glance.",
    "description": "Review the confirmation provided by the ordering service.",
    "action": "Track deliveries",
    "to": "/delivery-tracking",
    "scene": "a neatly sealed unbranded pharmacy parcel on a warm wooden table",
    "audience": "patient"
  },
  {
    "id": "hospitals",
    "route": "hospitals",
    "title": "Care close to your world.",
    "description": "Explore hospitals and the services they make available.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "an airy Nigerian hospital atrium with a Black Nigerian clinician welcoming an adult",
    "audience": "patient"
  },
  {
    "id": "hospital-detail",
    "route": "hospitals/:id",
    "title": "Get to know your care destination.",
    "description": "Review this hospital's services and available next steps.",
    "action": "All hospitals",
    "to": "/hospitals",
    "scene": "a sunlit hospital garden and modern welcoming entrance",
    "audience": "patient"
  },
  {
    "id": "hospital-enroll",
    "route": "hospitals/:id/enroll",
    "title": "Make your care connection.",
    "description": "Review the details required for hospital enrollment.",
    "action": "All hospitals",
    "to": "/hospitals",
    "scene": "a Black Nigerian adult speaking with a hospital registration officer at a clean desk",
    "audience": "patient"
  },
  {
    "id": "hospital-book",
    "route": "hospitals/:id/appointment",
    "title": "A visit that fits your day.",
    "description": "Choose from the appointment options this hospital offers.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian clinician and adult patient in a calm hospital waiting area",
    "audience": "patient"
  },
  {
    "id": "hospital-checkin",
    "route": "hospitals/check-in/:appointmentId",
    "title": "Arrive with a little more clarity.",
    "description": "Review your visit and follow the hospital's check-in instructions.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian adult greeted warmly at a hospital reception desk",
    "audience": "patient"
  },
  {
    "id": "wellness",
    "route": "wellness-hub",
    "title": "Wellbeing, in your own rhythm.",
    "description": "Find support across nutrition, movement and emotional wellbeing.",
    "action": "Explore professionals",
    "to": "/wellness-hub/professionals",
    "scene": "a Black Nigerian woman stretching gently in a peaceful leafy garden",
    "audience": "patient"
  },
  {
    "id": "professionals",
    "route": "wellness-hub/professionals",
    "title": "Meet your next care partner.",
    "description": "Explore approved professionals across distinct care disciplines.",
    "action": "Wellness Hub",
    "to": "/wellness-hub",
    "scene": "a diverse group of Black Nigerian wellness professionals in a sunlit studio",
    "audience": "patient"
  },
  {
    "id": "professional-book",
    "route": "wellness-hub/professionals/:id",
    "title": "Care that suits your needs.",
    "description": "Review this professional's practice and published availability.",
    "action": "All professionals",
    "to": "/wellness-hub/professionals",
    "scene": "a Black Nigerian counsellor listening to an adult in a warm calm consultation room",
    "audience": "patient"
  },
  {
    "id": "engagements",
    "route": "wellness-hub/engagements",
    "title": "Keep your wellbeing plans connected.",
    "description": "Manage the care engagements available to your account.",
    "action": "Wellness Hub",
    "to": "/wellness-hub",
    "scene": "a Black Nigerian adult with a personal blank planner and yoga mat in a light home",
    "audience": "patient"
  },
  {
    "id": "engagement-detail",
    "route": "wellness-hub/engagements/:engagementId",
    "title": "Stay connected to your care plan.",
    "description": "Review the details and next steps for this engagement.",
    "action": "All engagements",
    "to": "/wellness-hub/engagements",
    "scene": "a Black Nigerian wellness professional discussing a plain journal with an adult",
    "audience": "patient"
  },
  {
    "id": "wellness-category",
    "route": "wellness-hub/:categoryId",
    "title": "Find your kind of support.",
    "description": "Explore the practitioners listed for this wellbeing discipline.",
    "action": "Wellness Hub",
    "to": "/wellness-hub",
    "scene": "a calm wellbeing studio with a Black Nigerian practitioner and indoor plants",
    "audience": "patient"
  },
  {
    "id": "practitioner-detail",
    "route": "wellness-hub/:categoryId/:practitionerId",
    "title": "A more personal care connection.",
    "description": "Read about this practitioner before choosing your next step.",
    "action": "Wellness Hub",
    "to": "/wellness-hub",
    "scene": "a welcoming portrait scene of a fictional Black Nigerian wellness practitioner in a bright office",
    "audience": "patient"
  },
  {
    "id": "practitioner-book",
    "route": "wellness-hub/:categoryId/:practitionerId/book",
    "title": "Make space for your wellbeing.",
    "description": "Review the booking details and available times.",
    "action": "My engagements",
    "to": "/wellness-hub/engagements",
    "scene": "a Black Nigerian adult choosing a date on a blank calendar beside tea and a plant",
    "audience": "patient"
  },
  {
    "id": "insurance",
    "route": "insurance",
    "title": "Understand your care cover.",
    "description": "Review the insurance information and options available to your account.",
    "action": "Browse hospitals",
    "to": "/hospitals",
    "scene": "a Black Nigerian adult reading a plain insurance folder at a bright desk",
    "audience": "patient"
  },
  {
    "id": "wallet",
    "route": "wallet",
    "title": "Your care budget, in one place.",
    "description": "Explore your wallet workspace. Financial actions stay unavailable until connected.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian woman reviewing her personal budget in a blank notebook beside a plain wallet",
    "audience": "patient"
  }
];
export const doctorBanners = [
  {
    "id": "overview",
    "route": "dashboard",
    "title": "A little more space for better care.",
    "description": "Keep your day organised and your attention on the people you care for.",
    "action": "Set your availability",
    "to": "/availability",
    "scene": "a Black Nigerian female clinician reviewing a tablet in a serene sunlit clinic",
    "audience": "doctor"
  },
  {
    "id": "calendar",
    "route": "calendar",
    "title": "Your day, thoughtfully arranged.",
    "description": "Review your schedule and make space for focused care.",
    "action": "Manage availability",
    "to": "/availability",
    "scene": "a Black Nigerian doctor planning a work day beside a blank calendar and tea",
    "audience": "doctor"
  },
  {
    "id": "availability",
    "route": "availability",
    "title": "Make room for your practice.",
    "description": "Set weekly hours, appointment durations and one-off time blocks.",
    "action": "View calendar",
    "to": "/calendar",
    "scene": "a Black Nigerian doctor writing in a blank planner with a small desk clock",
    "audience": "doctor"
  },
  {
    "id": "appointments",
    "route": "appointments",
    "title": "Every visit deserves your attention.",
    "description": "Review your appointments and prepare for the care ahead.",
    "action": "View calendar",
    "to": "/calendar",
    "scene": "a Black Nigerian clinician welcoming an adult patient into a peaceful consulting room",
    "audience": "doctor"
  },
  {
    "id": "appointment-detail",
    "route": "appointments/:id",
    "title": "Prepare for a considered consultation.",
    "description": "Review this appointment and the actions available to your role.",
    "action": "All appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian doctor reviewing a plain unlabelled appointment folder",
    "audience": "doctor"
  },
  {
    "id": "patients",
    "route": "patients",
    "title": "People at the heart of your practice.",
    "description": "Access patient information only within your authorised care relationships.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian female clinician talking with an older adult patient in a sunny clinic",
    "audience": "doctor"
  },
  {
    "id": "consultations",
    "route": "consultations",
    "title": "Present for every conversation.",
    "description": "Manage your consultations and keep care notes connected.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian doctor holding a remote consultation on a laptop with a generic unrecognisable screen",
    "audience": "doctor"
  },
  {
    "id": "prescriptions",
    "route": "prescriptions",
    "title": "Precision in your care instructions.",
    "description": "Review prescribed treatments through the existing clinical workflow.",
    "action": "View consultations",
    "to": "/consultations",
    "scene": "a Black Nigerian doctor writing on a blank prescription pad beside a plain stethoscope",
    "audience": "doctor"
  },
  {
    "id": "patient-prescriptions",
    "route": "patient-prescriptions",
    "title": "Treatment details, clearly connected.",
    "description": "Review prescriptions linked to your authorised patient care.",
    "action": "View patients",
    "to": "/patients",
    "scene": "a Black Nigerian clinician reviewing an unlabelled medicine carton and plain paper",
    "audience": "doctor"
  },
  {
    "id": "reports",
    "route": "reports",
    "title": "A clear record of considered care.",
    "description": "Keep reports and follow-up guidance organised.",
    "action": "View consultations",
    "to": "/consultations",
    "scene": "a Black Nigerian doctor arranging plain report folders beside a leafy plant",
    "audience": "doctor"
  },
  {
    "id": "messages",
    "route": "messages",
    "title": "Good care stays connected.",
    "description": "Review your conversations and the communication tools available.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian clinician reading a message on a tablet in a comfortable office",
    "audience": "doctor"
  },
  {
    "id": "hospital",
    "route": "hospital-workspace",
    "title": "Connected to a wider care team.",
    "description": "Manage the hospital care relationships available to your role.",
    "action": "View patients",
    "to": "/patients",
    "scene": "Black Nigerian clinicians collaborating around a tablet in a bright hospital room",
    "audience": "doctor"
  },
  {
    "id": "earnings",
    "route": "earnings",
    "title": "A clearer view of your practice.",
    "description": "Review the financial information available for your professional account.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian professional reviewing a blank ledger at a warm tidy desk",
    "audience": "doctor"
  },
  {
    "id": "reviews",
    "route": "reviews",
    "title": "Listen. Reflect. Keep growing.",
    "description": "Review the feedback available about your care experience.",
    "action": "My profile",
    "to": "/profile",
    "scene": "a Black Nigerian clinician thoughtfully reading a plain feedback card beside tea",
    "audience": "doctor"
  },
  {
    "id": "notifications",
    "route": "notifications",
    "title": "Stay in step with your practice.",
    "description": "Review updates and choose the next action that matters.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian clinician checking a tablet beside a desk clock and a plant",
    "audience": "doctor"
  },
  {
    "id": "profile",
    "route": "profile",
    "title": "Your professional story.",
    "description": "Keep your practice details and professional profile up to date.",
    "action": "Manage availability",
    "to": "/availability",
    "scene": "a fictional Black Nigerian doctor posed naturally in a sunlit minimal consulting room",
    "audience": "doctor"
  },
  {
    "id": "settings",
    "route": "settings",
    "title": "A workspace that works for you.",
    "description": "Review your account settings and the controls available.",
    "action": "My profile",
    "to": "/profile",
    "scene": "a calm clinical desk with a tablet, plain notebook and stethoscope",
    "audience": "doctor"
  },
  {
    "id": "care-workspace",
    "route": "care-workspace",
    "title": "Considered support. Meaningful progress.",
    "description": "Build and review care plans within your professional discipline.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian counsellor and adult discussing a blank reflective journal",
    "audience": "doctor"
  },
  {
    "id": "nutrition-workspace",
    "route": "care-workspace",
    "title": "Nourishment with purpose.",
    "description": "Keep nutrition plans and patient feedback connected to your care.",
    "action": "My appointments",
    "to": "/appointments",
    "scene": "a Black Nigerian dietitian discussing a balanced meal with an adult in a bright studio",
    "audience": "doctor"
  },
  {
    "id": "patient-access",
    "route": "patient-access-preview",
    "title": "The right access, for the right care.",
    "description": "Patient records remain governed by consent and your authorised scope.",
    "action": "View patients",
    "to": "/patients",
    "scene": "a Black Nigerian clinician explaining a plain consent form to an adult",
    "audience": "doctor"
  }
];

function routeMatches(pattern, pathname) {
  const expected = pattern.split('/'), actual = pathname.replace(/^\/|\/$/g, '').split('/');
  return expected.length === actual.length && expected.every((part,index) => part.startsWith(':') || part === actual[index]);
}
export function resolvePageBanner(audience, pathname, professionType = 'DOCTOR') {
  const catalog = audience === 'doctor' ? doctorBanners : patientBanners;
  // Specific routes beat parameter routes; do not turn "prescription" into a pharmacy ID.
  const specificity = item => item.route.split('/').filter(part => !part.startsWith(':')).length;
  const sorted = [...catalog].sort((a,b) => specificity(b) - specificity(a));
  if (audience === 'patient' && pathname === '/family/join') pathname = '/family/add';
  if (audience === 'patient' && /^\/order-confirmation\/[^/]+$/.test(pathname)) pathname = '/order-confirmation';
  if (audience === 'doctor' && pathname === '/care-workspace') return catalog.find(item => item.id === (professionType === 'NUTRITIONIST_DIETITIAN' ? 'nutrition-workspace' : 'care-workspace'));
  return sorted.find(item => routeMatches(item.route, pathname)) || null;
}
