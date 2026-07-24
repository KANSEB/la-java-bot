// ============================================================
// Provisioning du serveur — logique de /setup-serveur.
// Idempotent : tout est recherché par nom avant création ;
// relancer la commande complète uniquement ce qui manque et
// resynchronise les permissions.
// ============================================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits as P,
  Role,
  type GuildBasedChannel,
  type OverwriteResolvable,
} from "discord.js";
import {
  BADGES, COULEURS, EDITION, nomBadge, PALIERS_XP, ROLE_BENEVOLE_DU_MOIS,
  ROLES, SALONS, STRUCTURE, TEXTES, type CategorieDef, type SalonDef,
} from "../config/config.js";
import { roleParNom } from "../services/util.js";
import { log } from "../services/logs.js";

export interface RapportSetup {
  rolesCrees: string[];
  salonsCrees: string[];
  existants: number;
}

// ---------- Rôles ----------
async function creerRoles(guild: Guild, rapport: RapportSetup): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();

  // Rôles fonctionnels — créés du bas vers le haut pour respecter la hiérarchie demandée
  const cles = Object.keys(ROLES).reverse();
  for (const cle of cles) {
    const def = ROLES[cle];
    let r = roleParNom(guild, def.nom);
    if (!r) {
      r = await guild.roles.create({
        name: def.nom,
        color: def.couleur,
        hoist: def.hoist,
        mentionable: def.mentionnable,
        permissions: def.permissions,
        reason: "Setup La Java",
      });
      rapport.rolesCrees.push(def.nom);
    } else {
      rapport.existants++;
    }
    map.set(cle, r);
  }

  // Rôles cosmétiques : badges d'édition, paliers XP, Bénévole du Mois — aucune permission
  const cosmetiques: { nom: string; couleur: number }[] = [
    ...Object.entries(BADGES).map(([annee, b]) => ({ nom: nomBadge(Number(annee)), couleur: b.couleur })),
    ...PALIERS_XP.map((p) => ({ nom: p.nom, couleur: p.couleur })),
    ROLE_BENEVOLE_DU_MOIS,
  ];
  for (const c of cosmetiques) {
    if (!roleParNom(guild, c.nom)) {
      await guild.roles.create({ name: c.nom, color: c.couleur, hoist: false, mentionable: false, permissions: [], reason: "Setup La Java (cosmétique)" });
      rapport.rolesCrees.push(c.nom);
    } else {
      rapport.existants++;
    }
  }
  return map;
}

// ---------- Permissions ----------
const VOIR = P.ViewChannel;
const ECRIRE = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads];
const VOCAL = [P.Connect, P.Speak];

/**
 * Calcule les overwrites d'un salon selon sa catégorie et ses options.
 * `ignorerCache = true` : renvoie les permissions "révélées" (pour /ouvrir-salon).
 */
export function overwritesPour(
  guild: Guild,
  roles: Map<string, Role>,
  cat: CategorieDef,
  salonDef: SalonDef,
  ignorerCache = false
): OverwriteResolvable[] {
  const everyone = guild.roles.everyone.id;
  const staff = roles.get("staff");
  const referent = roles.get("referent");
  const membre = roles.get("membre");
  const nonVerifie = roles.get("nonVerifie");
  const ow: OverwriteResolvable[] = [{ id: everyone, deny: [VOIR] }];

  // Salon masqué : visible Staff uniquement tant qu'il n'est pas révélé
  if (salonDef.cache && !ignorerCache) {
    if (staff) ow.push({ id: staff.id, allow: [VOIR, ...ECRIRE, ...VOCAL] });
    return ow;
  }

  const lectureSeule = salonDef.lectureSeule === true;

  if (cat.acces === "accueil") {
    // ACCUEIL : Non vérifié voit mais n'écrit pas ; les membres validés ne le voient plus
    if (nonVerifie) ow.push({ id: nonVerifie.id, allow: [VOIR], deny: ECRIRE });
  } else if (cat.acces === "public") {
    if (membre) ow.push({ id: membre.id, allow: [VOIR, ...(lectureSeule ? [] : ECRIRE), ...VOCAL], deny: lectureSeule ? ECRIRE : [] });
  } else {
    for (const cle of cat.acces) {
      const r = roles.get(cle);
      if (r) ow.push({ id: r.id, allow: [VOIR, ...(lectureSeule ? [] : ECRIRE), ...VOCAL], deny: lectureSeule ? ECRIRE : [] });
    }
  }

  // Le Staff voit et écrit toujours partout ; les Référents écrivent dans les salons lecture seule publics (ACTU)
  if (staff) ow.push({ id: staff.id, allow: [VOIR, ...ECRIRE, ...VOCAL] });
  if (lectureSeule && cat.acces === "public" && referent) ow.push({ id: referent.id, allow: [VOIR, ...ECRIRE] });
  return ow;
}

// ---------- Salons ----------
function typeDiscord(t: SalonDef["type"]): ChannelType {
  switch (t) {
    case "annonce": return ChannelType.GuildAnnouncement;
    case "forum": return ChannelType.GuildForum;
    case "media": return ChannelType.GuildMedia;
    case "vocal": return ChannelType.GuildVoice;
    case "stage": return ChannelType.GuildStageVoice;
    default: return ChannelType.GuildText;
  }
}

async function creerSalons(guild: Guild, roles: Map<string, Role>, rapport: RapportSetup): Promise<void> {
  for (const cat of STRUCTURE) {
    // Catégorie
    let categorie = guild.channels.cache.find(
      (c): c is CategoryChannel => c.type === ChannelType.GuildCategory && c.name === cat.nom
    );
    if (!categorie) {
      categorie = await guild.channels.create({ name: cat.nom, type: ChannelType.GuildCategory });
      rapport.salonsCrees.push(`[catégorie] ${cat.nom}`);
    }

    for (const def of cat.salons) {
      const nom = SALONS[def.cle];
      const existant = guild.channels.cache.find((c) => c.name === nom);
      const ow = overwritesPour(guild, roles, cat, def);

      if (existant) {
        // Resynchronise les permissions des salons existants (sauf ceux déjà révélés manuellement)
        if (!def.cache && "permissionOverwrites" in existant) {
          await existant.permissionOverwrites.set(ow).catch(() => {});
        }
        rapport.existants++;
        continue;
      }

      const type = typeDiscord(def.type);
      try {
        const options: Parameters<Guild["channels"]["create"]>[0] = {
          name: nom,
          type: type as never, // union stricte discord.js — le type est validé par typeDiscord()
          parent: categorie.id,
          permissionOverwrites: ow,
          ...(def.sujet && def.type !== "vocal" && def.type !== "stage" ? { topic: def.sujet } : {}),
          ...(def.tags ? { availableTags: def.tags.map((t) => ({ name: t })) } : {}),
        };
        await guild.channels.create(options);
        rapport.salonsCrees.push(nom);
      } catch (err) {
        // Les MEDIA channels ne sont pas dispo sur tous les serveurs → repli en forum
        if (def.type === "media") {
          await guild.channels.create({
            name: nom,
            type: ChannelType.GuildForum,
            parent: categorie.id,
            permissionOverwrites: ow,
            topic: def.sujet,
          });
          rapport.salonsCrees.push(`${nom} (repli forum)`);
        } else {
          throw err;
        }
      }
    }
  }
}

// ---------- Messages d'accueil, vérification, billetterie, countdown ----------
async function posterMessages(guild: Guild): Promise<void> {
  const { salonTexte } = await import("../services/util.js");

  // #bienvenue : règles + RGPD
  const bienvenue = salonTexte(guild, "bienvenue");
  if (bienvenue && !(await dejaPoste(bienvenue.id, guild))) {
    const embed = new EmbedBuilder().setTitle(TEXTES.bienvenueTitre).setDescription(TEXTES.bienvenueCorps).setColor(COULEURS.primaire);
    await bienvenue.send({ embeds: [embed] });
  }

  // #billetterie : bouton ticket
  const billetterie = salonTexte(guild, "billetterie");
  if (billetterie && !(await dejaPoste(billetterie.id, guild))) {
    const embed = new EmbedBuilder().setTitle(TEXTES.billetterieTitre).setDescription(TEXTES.billetterieCorps).setColor(COULEURS.info);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("btn_ticket").setLabel(TEXTES.boutonTicket).setEmoji("✉️").setStyle(ButtonStyle.Primary)
    );
    await billetterie.send({ embeds: [embed], components: [row] });
  }
}

/** Un message du bot avec embed existe-t-il déjà dans ce salon ? (idempotence) */
async function dejaPoste(channelId: string, guild: Guild): Promise<boolean> {
  const canal = guild.channels.cache.get(channelId);
  if (!canal || !canal.isTextBased()) return true;
  const messages = await canal.messages.fetch({ limit: 20 }).catch(() => null);
  return messages?.some((m) => m.author.id === guild.client.user.id && m.embeds.length > 0) ?? true;
}

// ---------- Point d'entrée ----------
export async function provisionner(guild: Guild): Promise<RapportSetup> {
  const rapport: RapportSetup = { rolesCrees: [], salonsCrees: [], existants: 0 };
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = await creerRoles(guild, rapport);
  await creerSalons(guild, roles, rapport);
  await posterMessages(guild);

  await log(
    guild,
    "🏗 Setup serveur exécuté",
    `Rôles créés : ${rapport.rolesCrees.length ? rapport.rolesCrees.join(", ") : "aucun (déjà en place)"}\n` +
    `Salons créés : ${rapport.salonsCrees.length ? rapport.salonsCrees.join(", ") : "aucun (déjà en place)"}\n` +
    `Éléments déjà existants : ${rapport.existants}`,
    "succes"
  );
  return rapport;
}

/** Révèle un salon masqué : réapplique les permissions "normales" de sa catégorie. */
export async function revelerSalon(guild: Guild, cleSalon: keyof typeof SALONS): Promise<GuildBasedChannel | null> {
  for (const cat of STRUCTURE) {
    const def = cat.salons.find((s) => s.cle === cleSalon);
    if (!def) continue;
    const canal = guild.channels.cache.find((c) => c.name === SALONS[def.cle]);
    if (!canal || !("permissionOverwrites" in canal)) return null;

    const roles = new Map<string, Role>();
    for (const cle of Object.keys(ROLES)) {
      const r = roleParNom(guild, ROLES[cle].nom);
      if (r) roles.set(cle, r);
    }
    await canal.permissionOverwrites.set(overwritesPour(guild, roles, cat, def, true));
    return canal;
  }
  return null;
}

/** Liste des clés de salons configurés comme masqués (pour l'autocomplete). */
export function salonsMasques(): { cle: keyof typeof SALONS; nom: string }[] {
  const out: { cle: keyof typeof SALONS; nom: string }[] = [];
  for (const cat of STRUCTURE) {
    for (const s of cat.salons) {
      if (s.cache) out.push({ cle: s.cle, nom: SALONS[s.cle] });
    }
  }
  return out;
}

