const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const User = require("../src/models/User");
const Post = require("../src/models/Post");
const Notification = require("../src/models/Notification");

const DEMO_PASSWORD = "DemoPass2026!";
const image = (id, width = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

const demoUsers = [
  { name: "Nika Beridze", username: "demo_nika", email: "demo.nika@example.test", avatar: image("photo-1500648767791-00dcc994a43e", 400), bio: "Demo account · Tbilisi walks, street photos, and good coffee." },
  { name: "Mariam Kapanadze", username: "demo_mariam", email: "demo.mariam@example.test", avatar: image("photo-1534528741775-53994a69daeb", 400), bio: "Demo account · Design, books, and small creative projects." },
  { name: "Giorgi Maisuradze", username: "demo_giorgi", email: "demo.giorgi@example.test", avatar: image("photo-1535713875002-d1d0cf377fde", 400), bio: "Demo account · Hiking trails and weekend escapes." },
  { name: "Ana Chikovani", username: "demo_ana", email: "demo.ana@example.test", avatar: image("photo-1524504388940-b1c1722653e1", 400), bio: "Demo account · Food, travel, and everyday moments." },
  { name: "Luka Japaridze", username: "demo_luka", email: "demo.luka@example.test", avatar: image("photo-1506794778202-cad84cf45f1d", 400), bio: "Demo account · Photography and the outdoors." },
  { name: "Tamar Abashidze", username: "demo_tamar", email: "demo.tamar@example.test", avatar: image("photo-1517841905240-472988babdf9", 400), bio: "Demo account · Music, art, and life in Tbilisi." },
];

const postSeeds = [
  [
    { text: "Tbilisi at golden hour never gets old. Took the long way home today.", image: image("photo-1500530855697-b586d89ba3ee") },
    { text: "A quiet morning, a strong coffee, and a fresh notebook. Starting the week right.", image: image("photo-1495474472287-4d71bcdd2085") },
  ],
  [
    { text: "Working on a little redesign today. The best ideas usually show up after a walk.", image: image("photo-1497366754035-f200968a6e72") },
    { text: "A good book and a sunny corner are all the plans I need for this afternoon.", image: image("photo-1512820790803-83ca734da794") },
  ],
  [
    { text: "Weekend trail report: clear skies, muddy boots, and a view worth every step.", image: image("photo-1470770841072-f978cf4d019e") },
    { text: "Reminder to step away from the screen and find a little green today.", image: image("photo-1470252649378-9c29740c9fa8") },
  ],
  [
    { text: "Found a tiny bakery on a side street and it might be my new favorite place.", image: image("photo-1509440159596-0249088772ff") },
    { text: "Collecting small moments from the city. This light was too good not to share.", image: image("photo-1519608487953-e999c86e7455") },
  ],
  [
    { text: "Blue skies, fresh air, and no notifications for a couple of hours. Highly recommend.", image: image("photo-1500534623283-312aade485b7") },
    { text: "The mountains make every problem feel a little smaller.", image: image("photo-1519681393784-d120267933ba") },
  ],
  [
    { text: "Made a playlist for the ride home. What song are you playing on repeat lately?", image: image("photo-1511379938547-c1f69419868d") },
    { text: "A little color and a little music can turn an ordinary day around.", image: image("photo-1492684223066-81342ee5ff30") },
  ],
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing from backend/.env");
  await mongoose.connect(process.env.MONGO_URI);

  const usernames = demoUsers.map((user) => user.username);
  const existing = await User.find({ username: { $in: usernames } }).select("username bio");
  const conflicts = existing.filter((user) => !user.bio?.startsWith("Demo account ·"));
  if (conflicts.length) {
    throw new Error(`Refusing to overwrite existing non-demo account(s): ${conflicts.map((user) => `@${user.username}`).join(", ")}`);
  }

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (const [index, seed] of demoUsers.entries()) {
    let user = existing.find((item) => item.username === seed.username);
    if (!user) {
      user = await User.create({ ...seed, password, clerkId: `demo-seed:${seed.username}` });
    } else {
      await User.updateOne({ _id: user._id }, { $set: { name: seed.name, email: seed.email, avatar: seed.avatar, bio: seed.bio } });
      user = await User.findById(user._id);
    }
    users.push(user);

    for (const postSeed of postSeeds[index]) {
      let post = await Post.findOne({ author: user._id, text: postSeed.text, parentPost: null });
      if (!post) post = await Post.create({ ...postSeed, author: user._id, parentPost: null });
    }
  }

  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const followed = users[(index + 1) % users.length];
    await User.updateOne({ _id: user._id }, { $addToSet: { following: followed._id } });
    await User.updateOne({ _id: followed._id }, { $addToSet: { followers: user._id } });
    if (!(await Notification.exists({ recipient: followed._id, sender: user._id, type: "follow" }))) {
      await Notification.create({ recipient: followed._id, sender: user._id, type: "follow" });
    }
  }

  const nika = users[0];
  const nikaPost = await Post.findOne({ author: nika._id, text: postSeeds[0][0].text });
  for (const actor of users.slice(1, 4)) {
    await Post.updateOne({ _id: nikaPost._id }, { $addToSet: { likes: actor._id } });
    const exists = await Notification.exists({ recipient: nika._id, sender: actor._id, type: "like", post: nikaPost._id });
    if (!exists) await Notification.create({ recipient: nika._id, sender: actor._id, type: "like", post: nikaPost._id });
  }

  const replyText = "That light is beautiful — this is going straight into my weekend plans.";
  let reply = await Post.findOne({ author: users[1]._id, parentPost: nikaPost._id, text: replyText });
  if (!reply) reply = await Post.create({ author: users[1]._id, parentPost: nikaPost._id, text: replyText });
  if (!(await Notification.exists({ recipient: nika._id, sender: users[1]._id, type: "reply", post: reply._id }))) {
    await Notification.create({ recipient: nika._id, sender: users[1]._id, type: "reply", post: reply._id });
  }

  console.log(`Seeded ${users.length} demo users, ${demoUsers.length * 2} demo posts, a reply, likes, follows, and notifications.`);
  console.log(`Demo login: ${demoUsers[0].email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
