// Guideline references used to attribute clinical prompts in the MCH / programme
// modules. These are POINTERS to published guidance, not an encoding of the
// guidance itself — the app does not implement or validate any clinical rule.

export type GuidelineReference = {
  key: string;
  /** short module label, e.g. "Antenatal care" */
  domain: string;
  /** publishing body */
  source: string;
  /** guideline title */
  title: string;
  version: string;
  effectiveDate: string;
  /** one-line summary of what the guidance covers */
  summary: string;
};

export const GUIDELINES: GuidelineReference[] = [
  {
    key: "anc-2016",
    domain: "Antenatal care",
    source: "World Health Organization",
    title: "WHO recommendations on antenatal care for a positive pregnancy experience",
    version: "2016",
    effectiveDate: "2016-11-07",
    summary: "Minimum of eight antenatal contacts; routine anaemia, syphilis and HIV testing; IPTp-SP, tetanus, iron and folic acid; blood pressure and proteinuria at every visit; danger-sign counselling.",
  },
  {
    key: "imci-2014",
    domain: "Child health (under-5)",
    source: "WHO / UNICEF",
    title: "Integrated Management of Childhood Illness (IMCI) chart booklet",
    version: "2014",
    effectiveDate: "2014-03-01",
    summary: "Assess for general danger signs, then cough/difficult breathing, diarrhoea, fever, ear problems, malnutrition and anaemia; classify and treat by colour band; check immunisation status.",
  },
  {
    key: "epi-ng-2022",
    domain: "Routine immunisation",
    source: "National Primary Health Care Development Agency (Nigeria)",
    title: "Nigeria Routine Immunisation Schedule",
    version: "2022",
    effectiveDate: "2022-01-01",
    summary: "BCG, OPV0 and Hepatitis B at birth; pentavalent, PCV, OPV and rotavirus at 6/10/14 weeks; IPV at 14 weeks; measles and yellow fever at 9 months; MR2 at 15 months.",
  },
  {
    key: "fp-2018",
    domain: "Family planning",
    source: "WHO",
    title: "Medical eligibility criteria for contraceptive use / Selected practice recommendations",
    version: "5th edition (2015) / 3rd edition (2016)",
    effectiveDate: "2016-01-01",
    summary: "Method eligibility by medical condition; ruling out pregnancy; timing of initiation; management of missed pills and injectables; return-visit schedule.",
  },
  {
    key: "cmam-ng-2016",
    domain: "Acute malnutrition",
    source: "Federal Ministry of Health (Nigeria)",
    title: "National Guidelines for Community Management of Acute Malnutrition",
    version: "2016",
    effectiveDate: "2016-01-01",
    summary: "MUAC and oedema screening; appetite test; admission to OTP/SC by classification; RUTF dosing by weight; discharge criteria.",
  },
  {
    key: "pnc-2013",
    domain: "Postnatal care",
    source: "World Health Organization",
    title: "WHO recommendations on postnatal care of the mother and newborn",
    version: "2013",
    effectiveDate: "2013-10-01",
    summary: "At least four postnatal contacts (day 1, day 3, week 2, week 6); assess maternal and newborn danger signs; support breastfeeding; postpartum family planning counselling.",
  },
];

export const guidelineByKey = (key: string) => GUIDELINES.find((guideline) => guideline.key === key);
