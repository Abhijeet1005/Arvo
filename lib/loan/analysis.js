// END-OF-CALL OUTPUT.
//
// A voice agent can't hand back a JSON blob when the line drops, so the
// structured profile is produced by ElevenLabs' post-call analysis instead:
// every item below is extracted from the full transcript after each call ends.
// That keeps it reliable even when the customer hangs up mid-flow.
//
// Keys match the client's END-OF-CALL OUTPUT exactly.

export const OUTCOMES = ['qualified', 'callback', 'not_interested', 'wrong_number', 'dnc'];

export const DATA_COLLECTION = {
  name: {
    type: 'string',
    description: "The customer's full name as confirmed on the call. Empty if it was never confirmed.",
  },
  phone: {
    type: 'string',
    description: 'The best contact number the customer confirmed, digits only. Empty if not discussed.',
  },
  city: { type: 'string', description: 'City and area/locality where the customer lives.' },
  residence_type: {
    type: 'string',
    description: 'Whether their home is "owned", "rented" or "family" (parents/family-owned). Empty if not discussed.',
  },
  property_owned: {
    type: 'string',
    description: 'Any property or land in the customer\'s name, briefly (e.g. "yes - plot in Jaipur" or "no"). Empty if not discussed.',
  },
  purpose: {
    type: 'string',
    description: 'What the loan is for (e.g. medical, wedding, business, education, home renovation), in English.',
  },
  amount: {
    type: 'integer',
    description: 'Loan amount the customer wants, in rupees, as a plain number (do lakh = 200000). 0 if not stated.',
  },
  age: { type: 'integer', description: "The customer's age in years. 0 if not stated." },
  employment_type: {
    type: 'string',
    enum: ['salaried', 'self-employed', 'business', 'other', 'unknown'],
    description: 'How the customer earns: salaried, self-employed, business, other, or unknown if not discussed.',
  },
  monthly_income: {
    type: 'integer',
    description: 'Monthly in-hand income in rupees as a plain number. 0 if not stated.',
  },
  company_or_business: {
    type: 'string',
    description: 'Employer or business name, and how long they have been there.',
  },
  existing_emis: {
    type: 'string',
    description: 'Existing loans or EMIs (with amounts if mentioned), or "none". Empty if not discussed.',
  },
  cibil_score: {
    type: 'string',
    description: 'Credit (CIBIL) score as the customer stated it; approximate is fine (e.g. "750", "around 700", "not known").',
  },
  cibil_last_checked: { type: 'string', description: 'When the customer last checked their credit score.' },
  pan_number: {
    type: 'string',
    description: 'PAN exactly as the customer confirmed it: 10 characters, uppercase, no spaces. Empty if not shared.',
  },
  callback_time: { type: 'string', description: 'Preferred callback day or time slot the customer gave.' },
  do_not_call: { type: 'boolean', description: 'True only if the customer asked not to be called again.' },
  outcome: {
    type: 'string',
    enum: OUTCOMES,
    description:
      'qualified = profile collected and handed to an executive; callback = customer asked to talk later; not_interested = customer declined; wrong_number = the person was not the customer; dnc = customer asked not to be called again.',
  },
  sentiment: {
    type: 'string',
    enum: ['positive', 'neutral', 'negative'],
    description: "The customer's overall sentiment on the call.",
  },
  notes: {
    type: 'string',
    description:
      'One or two sentences in English for the senior executive: urgency, the personal reason for the loan, objections raised, anything important.',
  },
  needs_human_review: {
    type: 'boolean',
    description:
      'True if the customer sounded desperate, is borrowing to repay another loan, tried to share an OTP, card, PIN or Aadhaar, or anything else felt off.',
  },
};

// Every call is also auto-audited against the script's hard rules.
export const EVALUATION_CRITERIA = [
  {
    id: 'compliance',
    name: 'Compliance',
    type: 'prompt',
    conversation_goal_prompt:
      'Success only if the agent: never asked for an OTP, card number, CVV, net-banking password, UPI PIN, full bank account number or Aadhaar number; never quoted an interest rate or a rate range; never promised approval, a disbursal timeline, a loan amount or a tenure; did not reveal enquiry details if someone other than the customer answered the phone; and stopped pitching immediately if asked not to be called again. Not violations: forwarding the profile to the company\'s own senior executive (the expected handoff); saying the customer was looking for a good interest rate; saying the company will try to get the lowest rate. "Quoting a rate" means stating a specific number or range, such as "10%" or "11 to 13 percent". Otherwise failure.',
  },
];

// Values the extraction model sometimes uses to mean "nothing".
const EMPTY = /^(null|undefined|n\/?a|not (mentioned|provided|discussed|stated|shared|given|available|specified)|unknown|-+)$/i;

function str(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return EMPTY.test(s) ? '' : s;
}

function bool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

// Rupee amounts and ages. Handles plain numbers plus spoken forms that slip
// through ("2 lakh", "50k", "1.5 crore").
function int(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const s = String(v ?? '').toLowerCase().replace(/,/g, '');
  const m = s.match(/\d+(?:\.\d+)?/);
  if (!m) return 0;
  let n = parseFloat(m[0]);
  if (/crore|\bcr\b/.test(s)) n *= 1e7;
  else if (/lakh|lac|\bl\b/.test(s)) n *= 1e5;
  else if (/thousand|hazaa?r|\bk\b/.test(s)) n *= 1e3;
  return Math.max(0, Math.round(n));
}

// PAN is identity data, so only the last four characters are ever stored or
// shown (the full value stays in the ElevenLabs conversation record).
export function maskPan(v) {
  const raw = str(v);
  const p = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!p || !/\d/.test(p)) return '';
  if (p.length <= 4) return 'X'.repeat(p.length);
  return 'X'.repeat(p.length - 4) + p.slice(-4);
}

// ElevenLabs conversation -> the client's END-OF-CALL OUTPUT shape.
// Returns null when there's no analysis (e.g. the call was too short).
export function resultFromConversation(conv, dialledName = '') {
  const dc = conv?.analysis?.data_collection_results;
  if (!dc || Object.keys(dc).length === 0) return null;
  const v = (k) => dc[k]?.value;

  let doNotCall = bool(v('do_not_call'));
  const rawOutcome = String(v('outcome') || '').toLowerCase();
  const outcome = OUTCOMES.includes(rawOutcome) ? rawOutcome : doNotCall ? 'dnc' : 'callback';
  if (outcome === 'dnc') doNotCall = true;

  const employment = str(v('employment_type'));

  return {
    name: str(v('name')) || dialledName,
    phone: str(v('phone')).replace(/[^\d+]/g, ''),
    city: str(v('city')),
    residence_type: str(v('residence_type')),
    property_owned: str(v('property_owned')),
    purpose: str(v('purpose')),
    amount: int(v('amount')),
    age: int(v('age')),
    employment_type: employment === 'unknown' ? '' : employment,
    monthly_income: int(v('monthly_income')),
    company_or_business: str(v('company_or_business')),
    existing_emis: str(v('existing_emis')),
    cibil_score: str(v('cibil_score')),
    cibil_last_checked: str(v('cibil_last_checked')),
    pan_number: maskPan(v('pan_number')),
    callback_time: str(v('callback_time')),
    do_not_call: doNotCall,
    outcome,
    sentiment: str(v('sentiment')),
    notes: str(v('notes')),
    needs_human_review: bool(v('needs_human_review')),
  };
}

// Call-level extras shown next to the profile.
export function callMetaFromConversation(conv) {
  const a = conv?.analysis || {};
  const check = a.evaluation_criteria_results?.compliance;
  return {
    summary: str(a.transcript_summary),
    title: str(a.call_summary_title),
    compliance: check ? { result: check.result || 'unknown', rationale: str(check.rationale) } : null,
    durationSecs: Number(conv?.metadata?.call_duration_secs) || 0,
  };
}
