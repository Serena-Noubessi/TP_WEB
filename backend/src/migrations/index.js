/** Liste ordonnée des migrations. Ne jamais modifier une migration déjà appliquée : en ajouter une nouvelle. */
import trackStyleVisibility from "./001-track-style-visibility.js";
import libraryAccess from "./002-library-access.js";
import friendsMessages from "./003-friends-messages.js";
import mixesSettingsAdmin from "./004-mixes-settings-admin.js";

export const migrations = [trackStyleVisibility, libraryAccess, friendsMessages, mixesSettingsAdmin];
