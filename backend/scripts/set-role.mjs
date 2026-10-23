/**
 * Donne ou retire le rôle administrateur (section 10). C'est le SEUL moyen de
 * créer un administrateur : aucune route de l'API ne le permet.
 *
 *   npm run role -- alice@exemple.fr admin
 *   npm run role -- alice@exemple.fr user
 *
 * Honore MONGODB_DB (base de démonstration ou de test).
 */
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const [email, role] = process.argv.slice(2);
if (!email || !["admin", "user"].includes(role)) {
  console.error("Usage : npm run role -- <email> <admin|user>");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});
try {
  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { $set: { role } }, { new: true });
  if (!user) {
    console.error(`[role] Aucun compte avec l'email ${email} dans la base ${mongoose.connection.db.databaseName}`);
    process.exitCode = 1;
  } else {
    console.log(`[role] ${user.name} (${user.email}) a maintenant le rôle « ${user.role} » dans la base ${mongoose.connection.db.databaseName}`);
  }
} finally {
  await mongoose.disconnect();
}
