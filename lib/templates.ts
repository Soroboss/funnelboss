// Templates centralisés (ton Bigréussite, FCFA). Variables :
// {prenom} {produit} {lien_checkout} {code_promo}
// Chaque template_key fournit une variante WhatsApp (texte) et/ou email.

export type TemplateVars = {
  prenom: string;
  produit: string;
  lien_checkout: string;
  code_promo: string;
};

type WhatsAppTpl = (v: TemplateVars) => string;
type EmailTpl = (v: TemplateVars) => { subject: string; html: string };

function emailWrap(body: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:520px">${body}
  <p style="color:#888;font-size:12px;margin-top:24px">Bigréussite · Côte d'Ivoire — Pour ne plus recevoir ces messages, répondez STOP.</p></div>`;
}

const WHATSAPP: Partial<Record<string, WhatsAppTpl>> = {
  abandon_doux: (v) =>
    `Bonjour ${v.prenom} 👋\nVous étiez à deux doigts de réserver ${v.produit}. Votre place est encore disponible !\n👉 ${v.lien_checkout}\n\nUne question ? Répondez ici, je vous aide.`,
  abandon_dernier_rappel: (v) =>
    `${v.prenom}, dernier rappel ⏳\nVotre accès à ${v.produit} part bientôt. On finalise maintenant ?\n👉 ${v.lien_checkout}\n\nCode promo : ${v.code_promo}`,
  merci_achat: (v) =>
    `Merci ${v.prenom} 🙏\nVotre commande "${v.produit}" est confirmée. Bienvenue chez Bigréussite !\nVous recevez tout par email. Besoin d'aide ? Écrivez-moi ici.`,
  reactivation_whatsapp: (v) =>
    `Bonjour ${v.prenom} 👋\nÇa fait un moment ! On a du nouveau chez Bigréussite qui devrait vous plaire.\n👉 ${v.lien_checkout}\n\nCode promo retour : ${v.code_promo}`,
};

const EMAIL: Partial<Record<string, EmailTpl>> = {
  abandon_promo: (v) => ({
    subject: `${v.prenom}, votre place pour ${v.produit} (+ une petite surprise)`,
    html: emailWrap(
      `<p>Bonjour ${v.prenom},</p>
       <p>Vous avez commencé à réserver <b>${v.produit}</b> mais n'avez pas finalisé. Pas de souci, votre panier vous attend.</p>
       <p>Pour vous décider, voici un code promo : <b>${v.code_promo}</b>.</p>
       <p><a href="${v.lien_checkout}" style="background:#f0930f;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Finaliser ma commande</a></p>`,
    ),
  }),
  upsell: (v) => ({
    subject: `${v.prenom}, et maintenant ? La suite logique après ${v.produit}`,
    html: emailWrap(
      `<p>Bonjour ${v.prenom},</p>
       <p>Merci encore pour votre confiance sur <b>${v.produit}</b>. Pour aller plus loin, on a sélectionné la suite idéale pour vous.</p>
       <p><a href="${v.lien_checkout}" style="background:#f0930f;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Découvrir</a></p>`,
    ),
  }),
  reactivation_email: (v) => ({
    subject: `${v.prenom}, on a pensé à vous (code ${v.code_promo})`,
    html: emailWrap(
      `<p>Bonjour ${v.prenom},</p>
       <p>Ça fait un moment qu'on ne vous a pas vu chez <b>Bigréussite</b>. On a du nouveau qui pourrait vous intéresser.</p>
       <p>Pour votre retour, profitez du code <b>${v.code_promo}</b>.</p>
       <p><a href="${v.lien_checkout}" style="background:#f0930f;color:#0a0a0a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">J'en profite</a></p>`,
    ),
  }),
};

function interpolate(s: string, v: TemplateVars): string {
  return s
    .replaceAll("{prenom}", v.prenom)
    .replaceAll("{produit}", v.produit)
    .replaceAll("{lien_checkout}", v.lien_checkout)
    .replaceAll("{code_promo}", v.code_promo);
}

/** Rendu d'un template pour un canal. Renvoie null si la combinaison n'existe pas. */
export function renderTemplate(
  key: string,
  channel: "whatsapp" | "email",
  vars: TemplateVars,
): { text: string } | { subject: string; html: string } | null {
  if (channel === "whatsapp") {
    const tpl = WHATSAPP[key];
    if (tpl) return { text: tpl(vars) };
    // Fallback générique si pas de variante WhatsApp pour cette clé.
    return { text: interpolate(`Bonjour {prenom}, un message de Bigréussite à propos de {produit}. {lien_checkout}`, vars) };
  }
  const tpl = EMAIL[key];
  if (tpl) return tpl(vars);
  return {
    subject: interpolate(`Bigréussite — {produit}`, vars),
    html: interpolate(`<p>Bonjour {prenom},</p><p>Un message à propos de {produit}.</p><p><a href="{lien_checkout}">Voir</a></p>`, vars),
  };
}
