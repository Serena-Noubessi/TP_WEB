// Remet à zéro les données sociales de la base de DÉMONSTRATION uniquement.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI, { dbName: "most-vibe-demo" });
const db = mongoose.connection.db;
if (db.databaseName !== "most-vibe-demo") throw new Error("Sécurité : ce script ne touche que most-vibe-demo");
for (const name of ["friendships", "blocks", "conversations", "messages", "notifications", "trackaccesses", "mixprojects", "remixrequests", "reports"]) {
  const result = await db.collection(name).deleteMany({});
  console.log(`[reset] ${name} : ${result.deletedCount} supprimé(s)`);
}
await db.collection("tracks").updateOne({ title: "Démo secrète" }, { $set: { visibility: "private" } });
// Comptes temporaires créés par les tests de l'étape 4.
const temp = await db.collection("users").deleteMany({ email: /^temp-.*@mostvibe\.test$/ });
console.log(`[reset] comptes temporaires : ${temp.deletedCount}`);
await db.collection("users").updateMany({ email: /@mostvibe\.test$/ }, { $set: { suspendedAt: null, suspendedReason: "", "privacy.showInSearch": true, "privacy.allowFriendRequests": true } });
await mongoose.disconnect();
