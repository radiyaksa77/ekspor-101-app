import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import localforage from "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.esm.min.js";

const firebaseConfig = {
  apiKey: "AIzaSyChcepu7datc3t3Lc_35-5Kx2ifa9uYv3I",
  authDomain: "ekspor-101.firebaseapp.com",
  projectId: "ekspor-101",
  storageBucket: "ekspor-101.appspot.com",
  appId: "1:148602540055:web:2d318d8c11ae7b297e4c52",
  measurementId: "G-KHTXXW8F9Y"
};

let app, auth, db;
const appId = firebaseConfig.projectId;

// LocalForage instances
const forumMessagesDB = localforage.createInstance({
  name: "ekspor101",
  storeName: "forumMessages"
});

const privateMessagesDB = localforage.createInstance({
  name: "ekspor101",
  storeName: "privateMessages"
});

const chatRequestsDB = localforage.createInstance({
  name: "ekspor101",
  storeName: "chatRequests"
});

// Theme toggle
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
});

// UI helper
function showMainApp() {
  document.getElementById("mainApp").classList.remove("hidden");
  document.getElementById("authPage").classList.add("hidden");
}

function showLoginPage() {
  document.getElementById("mainApp").classList.add("hidden");
  document.getElementById("authPage").classList.remove("hidden");
}

function showMessageBox(msg, type, box, messageEl, duration = 5000) {
  box.classList.remove("hidden");
  messageEl.innerText = msg;
  setTimeout(() => {
    box.classList.add("hidden");
    messageEl.innerText = "";
  }, duration);
}
// Auth logic
window.onload = async () => {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("User logged in:", user.uid);
      await loadUserProfile(user.uid);
      startForumListeners();
      listenForIncomingChatRequests();
      showMainApp();
    } else {
      showLoginPage();
    }
  });
};

async function handleAuth() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const mode = document.getElementById("authMode").value;
  const errorBox = document.getElementById("authError");
  const errorMessage = document.getElementById("authErrorMessage");

  try {
    if (mode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    console.error("Auth error:", error);
    let msg = "Gagal autentikasi.";
    if (error.code === "auth/wrong-password") msg = "Kata sandi salah.";
    else if (error.code === "auth/user-not-found") msg = "Akun tidak ditemukan.";
    else if (error.code === "auth/email-already-in-use") msg = "Email sudah digunakan.";
    showMessageBox(msg, "error", errorBox, errorMessage);
  }
}

document.getElementById("authSubmitBtn").addEventListener("click", handleAuth);

async function handleLogout() {
  await signOut(auth);
  showLoginPage();
}

document.getElementById("profileLogoutBtn")?.addEventListener("click", handleLogout);

async function loadUserProfile(uid) {
  const profileRef = doc(db, `artifacts/${appId}/users/${uid}/profile`, "data");
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    // Create new profile if not exists
    await setDoc(profileRef, {
      username: "User" + uid.slice(0, 5),
      messageCount: 0,
      userId: uid
    });
  }

  const data = (await getDoc(profileRef)).data();
  document.getElementById("profileInfo").innerHTML = `
    <div><strong>Username:</strong> ${data.username}</div>
    <div><strong>User ID:</strong> ${data.userId}</div>
    <div><strong>Pesan Terkirim:</strong> ${data.messageCount}</div>
  `;
}
function startForumListeners() {
  const forumRef = collection(db, `artifacts/${appId}/public/data/forum_messages`);
  const q = query(forumRef, orderBy("timestamp", "asc"));

  onSnapshot(q, async (snapshot) => {
    const forumMessages = document.getElementById("forumMessages");
    forumMessages.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.className = "p-2 rounded bg-slate-700";

      // Create username link
      const userLink = document.createElement("a");
      userLink.textContent = `@${msg.senderName}`;
      userLink.href = "#";
      userLink.className = "text-teal-400 hover:underline";
      userLink.dataset.uid = msg.senderId;
      userLink.dataset.username = msg.senderName;

      userLink.addEventListener("click", () => {
        openUserProfile(msg.senderId, msg.senderName);
      });

      div.appendChild(userLink);
      div.append(`: ${msg.text}`);
      forumMessages.appendChild(div);
    });

    await forumMessagesDB.setItem("cachedMessages", snapshot.docs.map(d => d.data()));
  });
}

document.getElementById("forumMessageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("forumMessageInput");
  const text = input.value.trim();
  if (!text) return;

  const user = auth.currentUser;
  const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, "data");
  const snap = await getDoc(profileRef);
  const data = snap.data();

  await addDoc(collection(db, `artifacts/${appId}/public/data/forum_messages`), {
    senderId: user.uid,
    senderName: data.username,
    text,
    timestamp: serverTimestamp()
  });

  // Increment message count
  await updateDoc(profileRef, {
    messageCount: (data.messageCount || 0) + 1
  });

  input.value = "";
});
// Find user feature
document.getElementById("findUserBtn").addEventListener("click", async () => {
  const userId = prompt("Masukkan User ID atau Username:");

  if (!userId) return;

  const usersRef = collection(db, `artifacts/${appId}/users`);
  onSnapshot(usersRef, (snapshot) => {
    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      if (docData.userId === userId || docData.username === userId) {
        openUserProfile(docData.userId, docData.username);
      }
    });
  });
});

function openUserProfile(uid, username) {
  document.querySelectorAll(".page-content").forEach(p => p.classList.add("hidden"));
  const page = document.getElementById("userProfilePage");
  page.classList.remove("hidden");

  document.getElementById("otherUserInfo").innerHTML = `
    <div><strong>Username:</strong> ${username}</div>
    <div><strong>User ID:</strong> ${uid}</div>
  `;

  const btn = document.getElementById("sendChatRequestBtn");
  btn.classList.remove("hidden");
  btn.onclick = () => showChatRequestModal(uid, username);
}

// Modal logic
function showChatRequestModal(recipientId, recipientName) {
  const overlay = document.getElementById("modalOverlay");
  const title = document.getElementById("modalTitle");
  const input = document.getElementById("modalInput");

  title.textContent = `Pesan untuk @${recipientName}`;
  input.value = "";

  overlay.classList.remove("hidden");

  document.getElementById("modalCancel").onclick = () => {
    overlay.classList.add("hidden");
  };

  document.getElementById("modalConfirm").onclick = () => {
    sendChatRequest(recipientId, recipientName, input.value.trim());
    overlay.classList.add("hidden");
  };
}

async function sendChatRequest(recipientId, recipientName, message) {
  const user = auth.currentUser;
  const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, "data");
  const snap = await getDoc(profileRef);
  const data = snap.data();

  await addDoc(collection(db, `artifacts/${appId}/chat_requests`), {
    senderId: user.uid,
    senderName: data.username,
    recipientId,
    recipientName,
    requestMessage: message,
    timestamp: serverTimestamp()
  });

  alert("Permintaan obrolan dikirim!");
}

function listenForIncomingChatRequests() {
  const user = auth.currentUser;
  const reqRef = collection(db, `artifacts/${appId}/chat_requests`);

  onSnapshot(reqRef, (snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.recipientId === user.uid) {
        const confirm = window.confirm(`@${data.senderName} mengirim permintaan obrolan:\n\n${data.requestMessage}\n\nTerima?`);
        if (confirm) {
          createPrivateChat(data.senderId, data.senderName);
          deleteDoc(doc(db, `artifacts/${appId}/chat_requests/${docSnap.id}`));
        } else {
          deleteDoc(doc(db, `artifacts/${appId}/chat_requests/${docSnap.id}`));
        }
      }
    });
  });
}

async function createPrivateChat(otherId, otherName) {
  // Simple implementation — bisa dikembangkan lebih canggih
  alert(`Obrolan pribadi dengan @${otherName} dibuat!`);
}
