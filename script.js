// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, where, getDocs, runTransaction, limit, startAfter } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Localforage for IndexedDB caching
import "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"; // Changed import statement to bare import

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyChcepu7datc3t3Lc_35-5Kx2ifa9uYv3I",
    authDomain: "ekspor-101.firebaseapp.com",
    projectId: "ekspor-101",
    storageBucket: "ekspor-101.firebasestorage.app",
    appId: "1:148602540055:web:2d318d8c11ae7b297e4c52",
    measurementId: "G-KHTXXW8F9Y"
};

// Global variables for Firebase app ID (derived from projectId for consistency)
const appId = firebaseConfig.projectId;

// Firebase App and Services
let app;
let db;
let auth;
let userId = null; // Akan diatur setelah autentikasi
let username = null; // Akan diatur dari profil pengguna di Firestore
let userRandomId = null; // ID acak pengguna
let userRole = 'user'; // Default role, could be 'user', 'official', 'admin'

// DOM Elements
const authPage = document.getElementById('authPage');
const mainApp = document.getElementById('mainApp');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const authTitle = document.getElementById('authTitle');
const authError = document.getElementById('authError');
const authErrorMessage = document.getElementById('authErrorMessage');
// const logoutBtn = document.getElementById('logoutBtn'); // Moved to profile area
const userIdDisplay = document.getElementById('userIdDisplay'); // This will now be primarily for showing the user's ID within the profile page
// const currentUserIdDisplay = document.getElementById('currentUserId'); // This element will be removed from header display logic

// Tombol Navigasi
const navForum = document.getElementById('navForum');
const navEkspor101 = document.getElementById('navEkspor101');
const navPrivateChat = document.getElementById('navPrivateChat');
const navProfile = document.getElementById('navProfile');
const navDonate = document.getElementById('navDonate');
const navButtons = [navForum, navEkspor101, navPrivateChat, navProfile, navDonate];

// Area Konten Halaman
const forumPage = document.getElementById('forumPage');
const ekspor101Page = document.getElementById('ekspor101Page');
const privateChatPage = document.getElementById('privateChatPage');
const profilePage = document.getElementById('profilePage');
const donatePage = document.getElementById('donatePage');
const pageContents = [forumPage, ekspor101Page, privateChatPage, profilePage, donatePage];

// Elemen Forum
const forumMessages = document.getElementById('forumMessages');
const forumMessageInput = document.getElementById('forumMessageInput');
const forumMessageForm = document.getElementById('forumMessageForm');
const loadMoreForumMessagesBtn = document.getElementById('loadMoreForumMessagesBtn');
// const forumAdTimerDisplay = document.getElementById('forumAdTimer'); // Removed as rewarded ads are removed

let lastVisibleForumMessage = null; // Untuk paginasi forum, dideklarasikan sekali di sini
const FORUM_MESSAGE_LIMIT = 20; // Jumlah pesan yang dimuat per halaman

// Elemen Obrolan Pribadi
const incomingRequestsList = document.getElementById('incomingRequestsList');
const privateChatRequestBadge = document.getElementById('privateChatRequestBadge');
const memberList = document.getElementById('memberList');
const activeChatsContainer = document.getElementById('activeChatsContainer');
const activeChatCountDisplay = document.getElementById('activeChatCount');
const selectedPrivateChatView = document.getElementById('selectedPrivateChatView');
const privateChatRecipientName = document.getElementById('privateChatRecipientName');
const privateChatMessages = document.getElementById('privateChatMessages');
const privateMessageInput = document.getElementById('privateMessageInput');
const privateMessageForm = document.getElementById('privateMessageForm');
const privateChatMessageBox = document.getElementById('privateChatMessageBox');
const privateChatErrorMessage = document.getElementById('privateChatErrorMessage');

let currentAuthMode = 'login'; // 'login' or 'register'
let activePrivateChatId = null; // Menyimpan ID obrolan pribadi yang sedang aktif
let activePrivateChatListener = null; // Menyimpan fungsi unsubscribe untuk pesan obrolan pribadi
let activePrivateChats = {}; // Menyimpan detail obrolan pribadi aktif {recipientId: {chatId, recipientId, recipientName}}
let incomingChatRequestsListener = null; // Listener for incoming chat requests
let allUsersListener = null; // Listener for all users in private chat
let privateChatsListener = null; // Listener for active private chats

// Elemen Profil
const profileUsernameDisplay = document.getElementById('profileUsername');
const profileUserIdDisplay = document.getElementById('profileUserId');
const profileMessageCountDisplay = document.getElementById('profileMessageCount');
const newUsernameInput = document.getElementById('newUsernameInput');
const updateUsernameBtn = document.getElementById('updateUsernameBtn');
const newPasswordInput = document.getElementById('newPasswordInput');
const updateUserPasswordBtn = document.getElementById('updatePasswordBtn'); // Renamed to avoid conflict
const profileUpdateMessage = document.getElementById('profileUpdateMessage');
const findUserInput = document.getElementById('findUserInput');
const findUserBtn = document.getElementById('findUserBtn');
const findUserMessage = document.getElementById('findUserMessage');
const foundUserProfile = document.getElementById('foundUserProfile');
const foundUsernameDisplay = document.getElementById('foundUsername');
const foundUserIdDisplay = document.getElementById('foundUserId');
const sendPmRequestBtn = document.getElementById('sendPmRequestBtn');
const sendPmRequestMessage = document.getElementById('sendPmRequestMessage');
const profileLogoutBtn = document.getElementById('profileLogoutBtn'); // New: Logout button in profile

// Elemen Donasi
const contactSupportBtn = document.getElementById('contactSupportBtn');

// Elemen Ekspor 101 (Bulletin Board)
const bulletinBoard = document.getElementById('bulletinBoard');

// Ad Placeholders
const bannerAd = document.getElementById('bannerAd');

// --- Inisialisasi IndexedDB dengan localforage ---
// Access localforage via window object since it's now a bare import
const forumMessagesDB = window.localforage.createInstance({
    name: "ekspor101_app",
    storeName: "forum_messages",
    description: "Pesan forum yang di-cache secara lokal"
});

const privateMessagesDB = window.localforage.createInstance({
    name: "ekspor101_app",
    storeName: "private_messages",
    description: "Pesan pribadi yang di-cache secara lokal"
});

const chatRequestsDB = window.localforage.createInstance({
    name: "ekspor101_app",
    storeName: "chat_requests",
    description: "Permintaan obrolan pribadi yang di-cache secara lokal"
});


// --- Fungsi Utilitas ---

// Helper untuk mendapatkan objek Date dari Firestore Timestamp atau objek Date
function getDisplayDate(timestamp) {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate(); // Firestore Timestamp
    } else if (timestamp instanceof Date) {
        return timestamp; // Native Date object
    }
    return null;
}

// Fungsi untuk menggulir obrolan ke bawah
function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

// Fungsi untuk menampilkan kotak pesan kustom (menggantikan alert)
function showMessageBox(message, type = 'error', targetElement = authError, targetMessageElement = authErrorMessage, duration = 5000) {
    targetMessageElement.textContent = message;
    targetElement.classList.remove('hidden', 'bg-red-100', 'bg-yellow-100', 'bg-green-100', 'border-red-400', 'border-yellow-400', 'border-green-400', 'text-red-700', 'text-yellow-700', 'text-green-700');
    if (type === 'error') {
        targetElement.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
    } else if (type === 'warning') {
        targetElement.classList.add('bg-yellow-100', 'border-yellow-400', 'text-yellow-700');
    } else if (type === 'success') {
        targetElement.classList.add('bg-green-100', 'border-green-400', 'text-green-700'); // Added success styling
    }
    setTimeout(() => {
        targetElement.classList.add('hidden');
    }, duration); // Sembunyikan setelah durasi
}

// Fungsi untuk menghasilkan ID pengguna acak (3 huruf + 4 angka)
function generateRandomUserId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    for (let i = 0; i < 4; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

// Fungsi untuk menampilkan pesan di UI obrolan
function displayChatMessage(message, targetElement, isPrivate = false, prepend = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('flex', 'items-start', 'space-x-2', 'mb-2'); // Added mb-2 for spacing

    const isCurrentUser = message.userId === userId;

    let bubbleClasses = 'p-3 rounded-lg max-w-[75%] shadow-sm';
    let textClasses = 'text-gray-800';
    let nameClasses = 'font-semibold text-sm';

    if (isCurrentUser) {
        messageElement.classList.add('self-end', 'justify-end');
        bubbleClasses += ' bg-blue-500 text-white';
        textClasses = 'text-white';
        nameClasses = 'font-semibold text-sm text-blue-200';
    } else {
        messageElement.classList.add('self-start', 'justify-start');
        bubbleClasses += ' bg-gray-200';
        textClasses = 'text-gray-800';
        nameClasses = 'font-semibold text-sm text-gray-600';
    }

    const displayDate = getDisplayDate(message.timestamp);
    const formattedTime = displayDate ? displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Mengirim...';

    // Add badge for official/admin users
    let usernameDisplay = message.username || 'Anonim';
    if (message.userRole === 'official') {
        usernameDisplay += ' <span class="text-xs bg-green-500 text-white px-1 rounded-full ml-1">Official</span>';
    } else if (message.userRole === 'admin') {
        usernameDisplay += ' <span class="text-xs bg-red-500 text-white px-1 rounded-full ml-1">Admin</span>';
    }

    let deleteButtonHtml = '';
    if (isCurrentUser) {
        deleteButtonHtml = `
            <button class="delete-message-btn text-red-400 hover:text-red-600 ml-2"
                    data-message-id="${message.id}"
                    data-chat-id="${isPrivate ? message.chatId : ''}"
                    data-is-private="${isPrivate}">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
    }

    messageElement.innerHTML = `
        <div class="flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}">
            <div class="flex items-center ${isCurrentUser ? 'flex-row-reverse' : ''}">
                <span class="${nameClasses} ${isPrivate ? '' : 'cursor-pointer forum-username'}" data-user-id="${message.userId}" data-username="${message.username}">${usernameDisplay}</span>
                ${deleteButtonHtml}
            </div>
            <div class="${bubbleClasses}">
                <p class="${textClasses}">${message.text}</p>
                <span class="text-xs ${isCurrentUser ? 'text-blue-300' : 'text-gray-500'} mt-1 block">
                    ${formattedTime}
                </span>
            </div>
        </div>
    `;
    if (prepend) {
        targetElement.prepend(messageElement);
    } else {
        targetElement.appendChild(messageElement);
    }

    // Add event listener for clicking username in forum
    if (!isPrivate) { // Only for forum messages
        const forumUsernameSpan = messageElement.querySelector('.forum-username');
        if (forumUsernameSpan) {
            forumUsernameSpan.addEventListener('click', (e) => {
                const clickedUserId = e.target.dataset.userId;
                const clickedUsername = e.target.dataset.username;
                if (clickedUserId !== userId) { // Prevent clicking on self
                    showPage(profilePage);
                    displayOtherUserProfile(clickedUserId, clickedUsername);
                }
            });
        }
    }

    // Add event listener for delete button
    const deleteBtn = messageElement.querySelector('.delete-message-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            const msgId = e.currentTarget.dataset.messageId;
            const isPriv = e.currentTarget.dataset.isPrivate === 'true';
            const chatId = e.currentTarget.dataset.chatId;

            if (isPriv) {
                await deletePrivateMessage(chatId, msgId);
            } else {
                await deleteForumMessage(msgId);
            }
        });
    }
}


// --- Logika Autentikasi ---

async function handleAuth() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessageBox('Silakan masukkan email dan kata sandi.', 'error');
        return;
    }

    try {
        if (currentAuthMode === 'register') {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const randomId = generateRandomUserId();
            // Simpan data profil pengguna di Firestore
            await setDoc(doc(db, `artifacts/${appId}/users`, user.uid), {
                email: user.email,
                username: email.split('@')[0], // Nama pengguna default dari email
                randomUserId: randomId,
                createdAt: serverTimestamp(),
                messageCount: 0, // Inisialisasi jumlah pesan
                role: 'user' // Default role for new users
            });
            username = email.split('@')[0]; // Atur nama pengguna global
            userRandomId = randomId;
            userRole = 'user';
            showMessageBox('Pendaftaran berhasil! Anda sekarang masuk.', 'success');
        } else { // currentAuthMode === 'login'
            await signInWithEmailAndPassword(auth, email, password);
            showMessageBox('Login berhasil!', 'success');
        }
    } catch (error) {
        console.error("Kesalahan autentikasi:", error);
        let errorMessage = "Terjadi kesalahan yang tidak diketahui.";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email ini sudah terdaftar. Coba masuk.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Format alamat email tidak valid.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Login email/kata sandi tidak diaktifkan. Silakan hubungi dukungan.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Kata sandi harus minimal 6 karakter.';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Email atau kata sandi tidak valid.';
                break;
            default:
                errorMessage = error.message;
        }
        showMessageBox(errorMessage, 'error');
    }
}

function toggleAuthMode() {
    if (currentAuthMode === 'login') {
        currentAuthMode = 'register';
        authTitle.textContent = 'Daftar';
        authSubmitBtn.textContent = 'Daftar';
        toggleAuthBtn.textContent = 'Sudah punya akun? Masuk';
    } else {
        currentAuthMode = 'login';
        authTitle.textContent = 'Masuk';
        authSubmitBtn.textContent = 'Masuk';
        toggleAuthBtn.textContent = 'Belum punya akun? Daftar';
    }
    authError.classList.add('hidden'); // Sembunyikan pesan kesalahan saat mode beralih
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Pengguna keluar.");
        // Hapus nama pengguna dari penyimpanan lokal jika terkait dengan sesi ini
        localStorage.removeItem('chatUsername');
        // Sembunyikan aplikasi utama, tampilkan halaman autentikasi
        mainApp.classList.add('hidden');
        userIdDisplay.classList.add('hidden'); // Ensure this is hidden when logged out
        authPage.classList.remove('hidden');
        // Bersihkan input
        emailInput.value = '';
        passwordInput.value = '';
        // Reset to login mode
        currentAuthMode = 'login';
        authTitle.textContent = 'Masuk';
        authSubmitBtn.textContent = 'Masuk';
        toggleAuthBtn.textContent = 'Belum punya akun? Daftar';

        // Hentikan semua listener
        if (forumMessagesListener) forumMessagesListener();
        if (allUsersListener) allUsersListener();
        if (activePrivateChatListener) activePrivateChatListener();
        if (privateChatsListener) privateChatsListener();
        if (incomingChatRequestsListener) incomingChatRequestsListener();
        if (userProfileListener) userProfileListener();
        if (bulletinListener) bulletinListener(); // Stop bulletin listener
    } catch (error) {
        console.error("Kesalahan saat keluar:", error);
        showMessageBox("Kesalahan saat keluar.", 'error');
    }
}

// --- Logika Navigasi ---

function showPage(pageToShow) {
    pageContents.forEach(page => {
        page.classList.add('hidden');
    });
    pageToShow.classList.remove('hidden');

    navButtons.forEach(btn => {
        btn.classList.remove('active', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });

    // Tambahkan kelas aktif ke tombol yang diklik
    if (pageToShow === forumPage) navForum.classList.add('active', 'text-blue-600');
    else if (pageToShow === ekspor101Page) navEkspor101.classList.add('active', 'text-blue-600');
    else if (pageToShow === privateChatPage) navPrivateChat.classList.add('active', 'text-blue-600');
    else if (pageToShow === profilePage) navProfile.classList.add('active', 'text-blue-600');
    else if (pageToShow === donatePage) navDonate.classList.add('active', 'text-blue-600');

    // Tindakan spesifik saat menampilkan halaman
    if (pageToShow === forumPage) {
        // Forum sekarang selalu dapat diakses, tidak ada iklan berhadiah
        startForumListeners();
    } else {
        if (forumMessagesListener) forumMessagesListener(); // Berhenti berlangganan
    }

    if (pageToShow === privateChatPage) {
        loadAllMembers();
        listenForActivePrivateChats();
        listenForIncomingChatRequests();
    } else {
        if (allUsersListener) allUsersListener(); // Berhenti berlangganan
        if (privateChatsListener) privateChatsListener(); // Berhenti berlangganan
        if (incomingChatRequestsListener) incomingChatRequestsListener(); // Berhenti berlangganan
        if (activePrivateChatListener) { // Berhenti berlangganan dari obrolan pribadi saat ini jika aktif
            activePrivateChatListener();
            activePrivateChatListener = null;
            selectedPrivateChatView.classList.add('hidden');
        }
    }

    if (pageToShow === profilePage) {
        loadUserProfile();
        // Clear find user results
        foundUserProfile.classList.add('hidden');
        findUserInput.value = '';
        findUserMessage.classList.add('hidden');
    } else {
        if (userProfileListener) userProfileListener(); // Berhenti berlangganan
    }

    if (pageToShow === ekspor101Page) {
        listenForBulletinUpdates();
    } else {
        if (bulletinListener) bulletinListener(); // Stop bulletin listener when leaving page
    }
}

// --- Logika Obrolan Forum ---
let forumMessagesListener; // Dideklarasikan sekali di sini

async function loadForumMessagesFromCache() {
    try {
        const cachedMessages = [];
        await forumMessagesDB.iterate((value, key, iterationNumber) => {
            cachedMessages.push(value);
        });
        // Urutkan berdasarkan timestamp karena iterate tidak menjamin urutan
        cachedMessages.sort((a, b) => {
            const timeA = getDisplayDate(a.timestamp)?.getTime() || 0;
            const timeB = getDisplayDate(b.timestamp)?.getTime() || 0;
            return timeA - timeB;
        });

        if (cachedMessages.length > 0) {
            forumMessages.innerHTML = ''; // Clear loading message
            cachedMessages.forEach(msg => displayChatMessage(msg, forumMessages, false));
            scrollToBottom(forumMessages);
            console.log(`Memuat ${cachedMessages.length} pesan forum dari cache.`);
        } else {
            forumMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Belum ada pesan forum di cache. Memuat dari server...</div>`;
        }
    } catch (err) {
        console.error("Gagal memuat pesan forum dari cache:", err);
        forumMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Gagal memuat dari cache.</div>`;
    }
}

async function startForumListeners() {
    if (forumMessagesListener) forumMessagesListener(); // Berhenti berlangganan listener sebelumnya jika ada

    // Muat dari cache terlebih dahulu
    await loadForumMessagesFromCache();

    // Ambil pesan terbaru dari Firestore (untuk pesan baru)
    const messagesRef = collection(db, `artifacts/${appId}/public/data/forum_messages`);
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(FORUM_MESSAGE_LIMIT)); // Ambil N pesan terakhir

    forumMessagesListener = onSnapshot(q, (snapshot) => {
        const newMessages = [];
        
        // Hapus pesan "Memuat..." jika ada pesan
        if (forumMessages.children.length > 0 && forumMessages.children[0].textContent.includes('Memuat')) {
            forumMessages.innerHTML = '';
        } else if (forumMessages.children.length === 0 && snapshot.empty) {
            forumMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Belum ada pesan. Jadilah yang pertama mengirim!</div>`;
        }

        snapshot.docChanges().forEach((change) => {
            const messageData = change.doc.data();
            messageData.id = change.doc.id; // Tambahkan ID dokumen
            if (change.type === "added") {
                // Periksa apakah pesan sudah ada di UI (dari cache atau sebelumnya)
                // Ini adalah pemeriksaan sederhana, mungkin perlu lebih canggih untuk menghindari duplikasi sempurna
                const existsInUI = Array.from(forumMessages.children).some(child => {
                    const pElement = child.querySelector('p');
                    return pElement && pElement.textContent === messageData.text &&
                           child.querySelector('.forum-username')?.dataset.userId === messageData.userId;
                });

                if (!existsInUI) {
                    newMessages.push(messageData);
                }
                forumMessagesDB.setItem(messageData.id, messageData); // Simpan/perbarui ke cache
            } else if (change.type === "modified") {
                // Perbarui di cache dan UI jika perlu
                forumMessagesDB.setItem(messageData.id, messageData);
                const existingMsgElement = Array.from(forumMessages.children).find(child => {
                    const pElement = child.querySelector('p');
                    return pElement && pElement.textContent === messageData.text &&
                           child.querySelector('.forum-username')?.dataset.userId === messageData.userId;
                });
                if (existingMsgElement) {
                    // Perbarui konten elemen yang ada
                    existingMsgElement.querySelector('p').textContent = messageData.text;
                    // Perbarui timestamp jika ditampilkan
                    const displayDate = getDisplayDate(messageData.timestamp);
                    const formattedTime = displayDate ? displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Mengirim...';
                    existingMsgElement.querySelector('span.text-xs').textContent = formattedTime;
                }
            } else if (change.type === "removed") {
                // Hapus dari cache dan UI
                forumMessagesDB.removeItem(messageData.id);
                const removedElement = Array.from(forumMessages.children).find(child => {
                    // Find by message ID if available, otherwise by content/user
                    const deleteButton = child.querySelector('.delete-message-btn');
                    return deleteButton && deleteButton.dataset.messageId === messageData.id;
                });
                if (removedElement) {
                    removedElement.remove();
                }
            }
        });

        // Urutkan pesan baru berdasarkan timestamp dan tambahkan ke UI
        newMessages.sort((a, b) => {
            const timeA = getDisplayDate(a.timestamp)?.getTime() || 0;
            const timeB = getDisplayDate(b.timestamp)?.getTime() || 0;
            return timeA - timeB;
        });
        newMessages.forEach(msg => displayChatMessage(msg, forumMessages, false));

        // Perbarui lastVisibleForumMessage untuk paginasi
        if (snapshot.docs.length > 0) {
            lastVisibleForumMessage = snapshot.docs[snapshot.docs.length - 1];
            loadMoreForumMessagesBtn.classList.remove('hidden');
        } else {
            lastVisibleForumMessage = null;
            loadMoreForumMessagesBtn.classList.add('hidden');
        }
        
        scrollToBottom(forumMessages);
        console.log("Pesan forum diperbarui dari Firestore.");

    }, (error) => {
        console.error("Gagal memuat pesan forum:", error);
        forumMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Gagal memuat pesan forum.</div>`;
    });
}

async function loadOlderForumMessages() {
    if (!lastVisibleForumMessage) {
        showMessageBox("Tidak ada lagi pesan lama.", 'info', forumMessages.parentElement);
        loadMoreForumMessagesBtn.classList.add('hidden');
        return;
    }

    try {
        const messagesRef = collection(db, `artifacts/${appId}/public/data/forum_messages`);
        const q = query(messagesRef, orderBy('timestamp', 'desc'), startAfter(lastVisibleForumMessage), limit(FORUM_MESSAGE_LIMIT));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showMessageBox("Tidak ada lagi pesan lama.", 'info', forumMessages.parentElement);
            loadMoreForumMessagesBtn.classList.add('hidden');
            return;
        }

        const oldMessages = [];
        snapshot.forEach(doc => {
            const messageData = doc.data();
            messageData.id = doc.id;
            oldMessages.push(messageData);
            forumMessagesDB.setItem(messageData.id, messageData); // Cache old messages
        });

        oldMessages.sort((a, b) => {
            const timeA = getDisplayDate(a.timestamp)?.getTime() || 0;
            const timeB = getDisplayDate(b.timestamp)?.getTime() || 0;
            return timeA - timeB;
        }); // Urutkan dari yang tertua ke terbaru

        // Tambahkan pesan ke bagian atas
        const currentScrollHeight = forumMessages.scrollHeight;
        const currentScrollTop = forumMessages.scrollTop;

        oldMessages.forEach(msg => displayChatMessage(msg, forumMessages, false, true)); // Prepend

        // Pertahankan posisi scroll
        forumMessages.scrollTop = currentScrollTop + (forumMessages.scrollHeight - currentScrollHeight);

        lastVisibleForumMessage = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < FORUM_MESSAGE_LIMIT) {
            loadMoreForumMessagesBtn.classList.add('hidden');
        }
        console.log(`Memuat ${oldMessages.length} pesan forum lama.`);

    } catch (error) {
        console.error("Gagal memuat pesan forum lama:", error);
        showMessageBox("Gagal memuat pesan lama.", 'error', forumMessages.parentElement);
    }
}


async function sendForumMessage(e) {
    e.preventDefault();
    const text = forumMessageInput.value.trim();

    if (text && userId && username) {
        try {
            const newMessage = {
                userId: userId,
                username: username,
                text: text,
                timestamp: serverTimestamp(),
                userRole: userRole // Include user role in message
            };
            const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/forum_messages`), newMessage);
            // Simpan juga ke IndexedDB
            newMessage.id = docRef.id;
            forumMessagesDB.setItem(newMessage.id, newMessage);

            // Perbarui jumlah pesan pengguna di profil
            const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
            await updateDoc(userDocRef, {
                messageCount: (await getDoc(userDocRef)).data().messageCount + 1
            });
            forumMessageInput.value = '';
            scrollToBottom(forumMessages);
        } catch (e) {
            console.error("Kesalahan saat mengirim pesan forum: ", e);
            showMessageBox("Gagal mengirim pesan.", 'error', forumMessages.parentElement); // Tampilkan kesalahan di dekat obrolan
        }
    } else if (!username) {
        showMessageBox("Silakan atur nama pengguna Anda di profil atau daftar terlebih dahulu.", 'warning', forumMessages.parentElement);
    }
}

async function deleteForumMessage(messageId) {
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('fixed', 'inset-0', 'bg-gray-900', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'p-4', 'z-50');
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Hapus Pesan Forum?</h3>
                <p class="text-gray-600 mb-6">Anda yakin ingin menghapus pesan ini dari forum? Ini tidak dapat dibatalkan.</p>
                <div class="flex justify-around">
                    <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300">Ya, Hapus</button>
                    <button id="cancelDeleteBtn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300">Batal</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmDeleteBtn').onclick = () => {
            modal.remove();
            resolve(true);
        };
        document.getElementById('cancelDeleteBtn').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });

    if (!confirmDelete) {
        return;
    }

    try {
        const messageDocRef = doc(db, `artifacts/${appId}/public/data/forum_messages`, messageId);
        const messageDoc = await getDoc(messageDocRef);

        if (messageDoc.exists() && messageDoc.data().userId === userId) {
            await deleteDoc(messageDocRef);
            forumMessagesDB.removeItem(messageId); // Remove from cache

            // Decrease user's message count
            const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
            await updateDoc(userDocRef, {
                messageCount: (await getDoc(userDocRef)).data().messageCount - 1
            });

            showMessageBox('Pesan forum berhasil dihapus.', 'success', forumMessages.parentElement);
        } else {
            showMessageBox('Anda tidak memiliki izin untuk menghapus pesan ini.', 'error', forumMessages.parentElement);
        }
    } catch (error) {
        console.error("Kesalahan saat menghapus pesan forum:", error);
        showMessageBox("Gagal menghapus pesan forum.", 'error', forumMessages.parentElement);
    }
}


// --- Logika Obrolan Pribadi ---

async function loadAllMembers() {
    if (allUsersListener) allUsersListener(); // Berhenti berlangganan listener sebelumnya jika ada

    memberList.innerHTML = `<li class="text-gray-500 text-sm italic">Memuat anggota...</li>`;
    const usersRef = collection(db, `artifacts/${appId}/users`);
    const q = query(usersRef, orderBy('username'));

    allUsersListener = onSnapshot(q, (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) {
            memberList.innerHTML = `<li class="text-gray-500 text-sm italic">Belum ada anggota lain ditemukan.</li>`;
            return;
        }
        snapshot.forEach((userDoc) => {
            const memberData = userDoc.data();
            if (userDoc.id === userId) return; // Jangan daftar pengguna saat ini

            const listItem = document.createElement('li');
            listItem.classList.add('p-2', 'bg-gray-50', 'rounded-lg', 'cursor-pointer', 'hover:bg-blue-100', 'transition', 'duration-200');
            
            let memberNameDisplay = memberData.username;
            if (memberData.role === 'official') {
                memberNameDisplay += ' <span class="text-xs bg-green-500 text-white px-1 rounded-full ml-1">Official</span>';
            } else if (memberData.role === 'admin') {
                memberNameDisplay += ' <span class="text-xs bg-red-500 text-white px-1 rounded-full ml-1">Admin</span>';
            }
            listItem.innerHTML = memberNameDisplay;

            listItem.dataset.userId = userDoc.id;
            listItem.dataset.username = memberData.username;
            listItem.addEventListener('click', () => {
                showPage(privateChatPage); // Stay on private chat page
                startPrivateChat(userDoc.id, memberData.username); // Directly start chat
            });
            memberList.appendChild(listItem);
        });
    }, (error) => {
        console.error("Gagal memuat anggota:", error);
        memberList.innerHTML = `<li class="text-red-500 text-sm italic">Gagal memuat anggota.</li>`;
    });
}

async function startPrivateChat(recipientId, recipientName) {
    if (activePrivateChats[recipientId]) {
        // Obrolan sudah aktif, cukup beralih ke sana
        selectPrivateChat(activePrivateChats[recipientId].chatId, recipientId, recipientName);
        return true; // Indicate success
    }

    // Hitung obrolan aktif dan permintaan keluar yang tertunda
    const currentActiveCount = Object.keys(activePrivateChats).length;
    const pendingOutgoingRequestsSnapshot = await getDocs(query(collection(db, `artifacts/${appId}/chat_requests`),
        where('senderId', '==', userId),
        where('recipientId', '==', recipientId), // Specifically for this recipient
        where('status', '==', 'pending')
    ));

    if (currentActiveCount + pendingOutgoingRequestsSnapshot.size >= 3) {
        showMessageBox("Anda telah mencapai batas 3 obrolan pribadi aktif (termasuk permintaan yang tertunda). Harap hapus obrolan yang ada untuk memulai yang baru.", 'warning', privateChatMessageBox, privateChatErrorMessage);
        return false; // Indicate failure
    }

    // Cek apakah permintaan sudah ada (baik dari atau ke pengguna ini)
    const existingRequestQuery = query(collection(db, `artifacts/${appId}/chat_requests`),
        where('senderId', 'in', [userId, recipientId]),
        where('recipientId', 'in', [userId, recipientId]),
        where('status', '==', 'pending')
    );
    const existingRequests = await getDocs(existingRequestQuery);
    if (!existingRequests.empty) {
        showMessageBox("Permintaan obrolan ke pengguna ini sudah ada atau sedang menunggu balasan.", 'warning', privateChatMessageBox, privateChatErrorMessage);
        return false; // Indicate failure
    }

    // Buat ID obrolan unik dengan mengurutkan UID peserta
    const participants = [userId, recipientId].sort();
    const chatId = participants.join('_');
    const chatRef = doc(db, `artifacts/${appId}/private_chats`, chatId);

    try {
        await runTransaction(db, async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists()) {
                // Buat dokumen obrolan pribadi baru
                transaction.set(chatRef, {
                    participants: participants,
                    createdAt: serverTimestamp(),
                    lastMessageAt: serverTimestamp(),
                    participantNames: {
                        [userId]: username,
                        [recipientId]: recipientName
                    }
                });
            }

            // Kirim permintaan obrolan
            const requestDocRef = doc(collection(db, `artifacts/${appId}/chat_requests`));
            const newRequest = {
                senderId: userId,
                senderUsername: username,
                recipientId: recipientId,
                recipientUsername: recipientName,
                status: 'pending',
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 hari dari sekarang
                chatId: chatId // Simpan chatId untuk referensi
            };
            transaction.set(requestDocRef, newRequest);
            chatRequestsDB.setItem(requestDocRef.id, newRequest); // Cache request
        });

        // Tambahkan ke obrolan aktif dan pilih
        activePrivateChats[recipientId] = { chatId: chatId, recipientId: recipientId, recipientName: recipientName };
        updateActiveChatsUI();
        selectPrivateChat(chatId, recipientId, recipientName); // Select it immediately as it consumes a slot

        showMessageBox("Permintaan obrolan pribadi berhasil dikirim dan dihitung dalam batas obrolan Anda.", 'success', privateChatMessageBox, privateChatErrorMessage);
        showInterstitialAd(); // Tampilkan iklan interstitial setelah berhasil mengirim permintaan
        return true; // Indicate success

    } catch (error) {
        console.error("Kesalahan saat memulai obrolan pribadi:", error);
        showMessageBox("Gagal memulai obrolan pribadi.", 'error', privateChatMessageBox, privateChatErrorMessage);
        return false; // Indicate failure
    }
}

function updateActiveChatsUI() {
    activeChatsContainer.innerHTML = '';
    activeChatCountDisplay.textContent = Object.keys(activePrivateChats).length;

    if (Object.keys(activePrivateChats).length === 0) {
        activeChatsContainer.innerHTML = `<span class="text-gray-500 text-sm italic">Belum ada obrolan aktif. Klik anggota untuk memulai!</span>`;
        return;
    }

    for (const recipientId in activePrivateChats) {
        const chat = activePrivateChats[recipientId];
        const chatButton = document.createElement('button');
        chatButton.classList.add('bg-blue-200', 'hover:bg-blue-300', 'text-blue-800', 'font-semibold', 'py-2', 'px-4', 'rounded-full', 'flex', 'items-center', 'space-x-2', 'transition', 'duration-200', 'shadow-sm');
        chatButton.dataset.chatId = chat.chatId; // Store chat ID
        chatButton.dataset.recipientId = chat.recipientId; // Store recipient ID
        chatButton.dataset.recipientName = chat.recipientName; // Store recipient name

        if (chat.chatId === activePrivateChatId) {
            chatButton.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-600');
        }
        chatButton.innerHTML = `
            <span>${chat.recipientName}</span>
            <button class="delete-chat-btn text-red-600 hover:text-red-800 ml-2" data-chat-id="${chat.chatId}" data-recipient-id="${chat.recipientId}">
                <i class="fas fa-times-circle"></i>
            </button>
        `;
        chatButton.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-chat-btn')) {
                selectPrivateChat(chat.chatId, chat.recipientId, chat.recipientName);
            }
        });
        activeChatsContainer.appendChild(chatButton);
    }

    // Tambahkan event listener untuk tombol hapus
    document.querySelectorAll('.delete-chat-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Mencegah klik tombol juga memilih obrolan
            const chatIdToDelete = button.dataset.chatId;
            const recipientIdToDelete = button.dataset.recipientId;
            deletePrivateChat(chatIdToDelete, recipientIdToDelete);
        };
    });
}

async function loadPrivateMessagesFromCache(chatId) {
    try {
        const cachedMessages = [];
        await privateMessagesDB.iterate((value, key, iterationNumber) => {
            if (value.chatId === chatId) { // Filter by current chat ID
                cachedMessages.push(value);
            }
        });
        cachedMessages.sort((a, b) => {
            const timeA = getDisplayDate(a.timestamp)?.getTime() || 0;
            const timeB = getDisplayDate(b.timestamp)?.getTime() || 0;
            return timeA - timeB;
        });

        if (cachedMessages.length > 0) {
            privateChatMessages.innerHTML = ''; // Clear loading message
            cachedMessages.forEach(msg => displayChatMessage(msg, privateChatMessages, true));
            scrollToBottom(privateChatMessages);
            console.log(`Memuat ${cachedMessages.length} pesan pribadi dari cache untuk chat ${chatId}.`);
        } else {
            privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Belum ada pesan pribadi di cache. Memuat dari server...</div>`;
        }
    } catch (err) {
        console.error("Gagal memuat pesan pribadi dari cache:", err);
        privateChatMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Gagal memuat dari cache.</div>`;
    }
}


function selectPrivateChat(chatId, recipientId, recipientName) {
    if (activePrivateChatListener) {
        activePrivateChatListener(); // Berhenti berlangganan dari obrolan sebelumnya
    }
    activePrivateChatId = chatId;
    privateChatRecipientName.textContent = recipientName;
    selectedPrivateChatView.classList.remove('hidden');
    privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Memuat pesan pribadi...</div>`;

    // Muat dari cache terlebih dahulu
    loadPrivateMessagesFromCache(chatId);

    // Perbarui gaya tombol obrolan aktif
    document.querySelectorAll('#activeChatsContainer button').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white', 'hover:bg-blue-600');
        btn.classList.add('bg-blue-200', 'text-blue-800', 'hover:bg-blue-300');
        if (btn.dataset.chatId === chatId) {
            btn.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-600');
        }
    });


    const messagesRef = collection(db, `artifacts/${appId}/private_chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp'));

    activePrivateChatListener = onSnapshot(q, (snapshot) => {
        // Clear current messages if this is the first load from Firestore after cache
        if (privateChatMessages.children.length > 0 && privateChatMessages.children[0].textContent.includes('Memuat dari server')) {
            privateChatMessages.innerHTML = '';
        } else if (privateChatMessages.children.length === 0 && snapshot.empty) {
             privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Belum ada pesan di obrolan pribadi ini.</div>`;
        }

        snapshot.docChanges().forEach((change) => {
            const messageData = change.doc.data();
            messageData.id = change.doc.id; // Add document ID
            messageData.chatId = chatId; // Add chat ID for caching
            if (change.type === "added") {
                displayChatMessage(messageData, privateChatMessages, true);
                privateMessagesDB.setItem(messageData.id, messageData); // Cache new messages
            } else if (change.type === "modified") {
                privateMessagesDB.setItem(messageData.id, messageData); // Update cache
            } else if (change.type === "removed") {
                privateMessagesDB.removeItem(messageData.id); // Remove from cache
                // Remove message from UI
                const removedElement = Array.from(privateChatMessages.children).find(child => {
                    const deleteButton = child.querySelector('.delete-message-btn');
                    return deleteButton && deleteButton.dataset.messageId === messageData.id;
                });
                if (removedElement) {
                    removedElement.remove();
                }
            }
        });
        scrollToBottom(privateChatMessages);
        console.log("Pesan pribadi diperbarui dari Firestore.");

    }, (error) => {
        console.error("Gagal memuat pesan pribadi:", error);
        privateChatMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Gagal memuat pesan pribadi.</div>`;
    });
}

async function sendPrivateMessage(e) {
    e.preventDefault();
    const text = privateMessageInput.value.trim();

    if (text && userId && username && activePrivateChatId) {
        try {
            const messagesCollectionRef = collection(db, `artifacts/${appId}/private_chats/${activePrivateChatId}/messages`);
            const newMessage = {
                userId: userId,
                username: username,
                text: text,
                timestamp: serverTimestamp(),
                userRole: userRole // Include user role in message
            };
            const docRef = await addDoc(messagesCollectionRef, newMessage);
            // Simpan juga ke IndexedDB
            newMessage.id = docRef.id;
            newMessage.chatId = activePrivateChatId;
            privateMessagesDB.setItem(newMessage.id, newMessage);

            // Perbarui lastMessageAt untuk dokumen obrolan pribadi
            const chatDocRef = doc(db, `artifacts/${appId}/private_chats`, activePrivateChatId);
            await updateDoc(chatDocRef, {
                lastMessageAt: serverTimestamp()
            });

            privateMessageInput.value = '';
            scrollToBottom(privateChatMessages);
        } catch (e) {
            console.error("Kesalahan saat mengirim pesan pribadi: ", e);
            showMessageBox("Gagal mengirim pesan pribadi.", 'error', privateChatMessageBox, privateChatErrorMessage);
        }
    }
}

async function deletePrivateChat(chatId, recipientId) {
    // Tampilkan konfirmasi kustom
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('fixed', 'inset-0', 'bg-gray-900', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'p-4', 'z-50');
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Hapus Obrolan?</h3>
                <p class="text-gray-600 mb-6">Anda yakin ingin menghapus obrolan dengan ${activePrivateChats[recipientId]?.recipientName || 'pengguna ini'}? Ini tidak dapat dibatalkan.</p>
                <div class="flex justify-around">
                    <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300">Ya, Hapus</button>
                    <button id="cancelDeleteBtn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300">Batal</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmDeleteBtn').onclick = () => {
            modal.remove();
            resolve(true);
        };
        document.getElementById('cancelDeleteBtn').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });

    if (!confirmDelete) {
        return;
    }

    try {
        // Unsubscribe from the chat if it's currently open
        if (activePrivateChatId === chatId && activePrivateChatListener) {
            activePrivateChatListener();
            activePrivateChatListener = null;
            activePrivateChatId = null;
            selectedPrivateChatView.classList.add('hidden'); // Hide chat view
            privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Pilih obrolan atau mulai yang baru.</div>`;
        }

        // Hapus semua pesan di dalam subkoleksi terlebih dahulu
        // Catatan: Untuk koleksi besar, ini harus dilakukan di Cloud Functions.
        const messagesRef = collection(db, `artifacts/${appId}/private_chats/${chatId}/messages`);
        const messageDocs = await getDocs(messagesRef);
        const deleteMessagePromises = [];
        messageDocs.forEach(msgDoc => {
            deleteMessagePromises.push(deleteDoc(doc(db, `artifacts/${appId}/private_chats/${chatId}/messages`, msgDoc.id)));
            privateMessagesDB.removeItem(msgDoc.id); // Hapus from cache
        });
        await Promise.all(deleteMessagePromises);

        // Kemudian hapus dokumen obrolan pribadi itu sendiri
        await deleteDoc(doc(db, `artifacts/${appId}/private_chats`, chatId));

        // Hapus dari objek activePrivateChats
        // Find the recipientId associated with this chatId to remove it correctly
        let recipientIdToRemove = null;
        for (const rId in activePrivateChats) {
            if (activePrivateChats[rId].chatId === chatId) {
                recipientIdToRemove = rId;
                break;
            }
        }
        if (recipientIdToRemove) {
            delete activePrivateChats[recipientIdToRemove];
        }
        updateActiveChatsUI(); // Perbarui UI

        showMessageBox("Obrolan pribadi berhasil dihapus.", 'success', privateChatMessageBox, privateChatErrorMessage);

    } catch (error) {
        console.error("Kesalahan saat menghapus obrolan pribadi:", error);
        showMessageBox("Gagal menghapus obrolan pribadi.", 'error', privateChatMessageBox, privateChatErrorMessage);
    }
}

async function deletePrivateMessage(chatId, messageId) {
    const confirmDelete = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.classList.add('fixed', 'inset-0', 'bg-gray-900', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'p-4', 'z-50');
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm text-center">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Hapus Pesan Pribadi?</h3>
                <p class="text-gray-600 mb-6">Anda yakin ingin menghapus pesan ini dari obrolan pribadi? Ini tidak dapat dibatalkan.</p>
                <div class="flex justify-around">
                    <button id="confirmDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300">Ya, Hapus</button>
                    <button id="cancelDeleteBtn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300">Batal</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmDeleteBtn').onclick = () => {
            modal.remove();
            resolve(true);
        };
        document.getElementById('cancelDeleteBtn').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });

    if (!confirmDelete) {
        return;
    }

    try {
        const messageDocRef = doc(db, `artifacts/${appId}/private_chats/${chatId}/messages`, messageId);
        const messageDoc = await getDoc(messageDocRef);

        if (messageDoc.exists() && messageDoc.data().userId === userId) {
            await deleteDoc(messageDocRef);
            privateMessagesDB.removeItem(messageId); // Remove from cache
            showMessageBox('Pesan pribadi berhasil dihapus.', 'success', privateChatMessageBox, privateChatErrorMessage);
        } else {
            showMessageBox('Anda tidak memiliki izin untuk menghapus pesan ini.', 'error', privateChatMessageBox, privateChatErrorMessage);
        }
    } catch (error) {
        console.error("Kesalahan saat menghapus pesan pribadi:", error);
        showMessageBox("Gagal menghapus pesan pribadi.", 'error', privateChatMessageBox, privateChatErrorMessage);
    }
}


function listenForActivePrivateChats() {
    if (privateChatsListener) privateChatsListener(); // Berhenti berlangganan listener sebelumnya

    // Dengarkan dokumen obrolan pribadi di mana pengguna saat ini adalah peserta
    const chatsRef = collection(db, `artifacts/${appId}/private_chats`);
    const q = query(chatsRef, where('participants', 'array-contains', userId), orderBy('lastMessageAt', 'desc'));

    privateChatsListener = onSnapshot(q, (snapshot) => {
        activePrivateChats = {}; // Reset obrolan aktif
        snapshot.forEach(doc => {
            const chatData = doc.data();
            const otherParticipantId = chatData.participants.find(pId => pId !== userId);
            const otherParticipantName = chatData.participantNames[otherParticipantId] || 'Pengguna Tidak Dikenal';
            activePrivateChats[otherParticipantId] = {
                chatId: doc.id,
                recipientId: otherParticipantId,
                recipientName: otherParticipantName
            };
        });
        updateActiveChatsUI();
    }, (error) => {
        console.error("Gagal memuat obrolan pribadi aktif:", error);
        showMessageBox("Gagal memuat obrolan pribadi aktif.", 'error', privateChatMessageBox, privateChatErrorMessage);
    });
}

// Logika Permintaan Obrolan Pribadi
// `incomingChatRequestsListener` dideklarasikan secara global di bagian atas file.

async function listenForIncomingChatRequests() {
    if (incomingChatRequestsListener) incomingChatRequestsListener(); // Unsubscribe previous listener

    incomingRequestsList.innerHTML = `<li class="text-gray-500 text-sm italic">Memuat permintaan...</li>`;
    const requestsRef = collection(db, `artifacts/${appId}/chat_requests`);
    const now = new Date();

    const q = query(requestsRef,
        where('recipientId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc') // Order by creation time
    );

    incomingChatRequestsListener = onSnapshot(q, (snapshot) => {
        incomingRequestsList.innerHTML = '';
        let pendingRequestsCount = 0;
        if (snapshot.empty) {
            incomingRequestsList.innerHTML = `<li class="text-gray-500 text-sm italic">Belum ada permintaan obrolan masuk.</li>`;
            privateChatRequestBadge.classList.add('hidden');
        } else {
            snapshot.forEach((docSnap) => {
                const request = docSnap.data();
                const requestId = docSnap.id;
                const expiresAtDate = request.expiresAt ? getDisplayDate(request.expiresAt) : null;

                // Filter out expired requests client-side
                if (expiresAtDate && expiresAtDate < now) {
                    // CATATAN: Untuk menghapus permintaan kedaluwarsa dari database,
                    // Anda memerlukan Firebase Cloud Function yang berjalan di sisi server.
                    // Klien tidak boleh memiliki izin penghapusan massal.
                    // deleteDoc(doc(db, `artifacts/${appId}/chat_requests`, requestId)).catch(e => console.error("Error deleting expired request:", e));
                    chatRequestsDB.removeItem(requestId); // Hapus dari cache lokal
                    return; // Lewati menampilkan permintaan yang kedaluwarsa
                }

                pendingRequestsCount++;
                const listItem = document.createElement('li');
                listItem.classList.add('p-3', 'bg-blue-50', 'rounded-lg', 'shadow-sm', 'flex', 'flex-col', 'space-y-2');
                listItem.innerHTML = `
                    <p class="text-gray-800">Permintaan dari: <span class="font-semibold">${request.senderUsername}</span></p>
                    <div class="flex justify-end space-x-2">
                        <button class="accept-request-btn bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-md transition duration-200" data-request-id="${requestId}" data-sender-id="${request.senderId}" data-sender-username="${request.senderUsername}" data-chat-id="${request.chatId}">Terima</button>
                        <button class="deny-request-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition duration-200" data-request-id="${requestId}">Tolak</button>
                    </div>
                `;
                incomingRequestsList.appendChild(listItem);
                chatRequestsDB.setItem(requestId, request); // Cache request
            });

            if (pendingRequestsCount > 0) {
                privateChatRequestBadge.classList.remove('hidden');
                privateChatRequestBadge.textContent = pendingRequestsCount;
            } else {
                incomingRequestsList.innerHTML = `<li class="text-gray-500 text-sm italic">Belum ada permintaan obrolan masuk.</li>`;
                privateChatRequestBadge.classList.add('hidden');
            }
        }

        // Add event listeners for new buttons
        document.querySelectorAll('.accept-request-btn').forEach(btn => {
            btn.onclick = (e) => handleChatRequest(e.target.dataset.requestId, 'accept', e.target.dataset.senderId, e.target.dataset.senderUsername, e.target.dataset.chatId);
        });
        document.querySelectorAll('.deny-request-btn').forEach(btn => {
            btn.onclick = (e) => handleChatRequest(e.target.dataset.requestId, 'deny');
        });

    }, (error) => {
        console.error("Gagal memuat permintaan obrolan masuk:", error);
        incomingRequestsList.innerHTML = `<li class="text-red-500 text-sm italic">Gagal memuat permintaan obrolan masuk.</li>`;
        privateChatRequestBadge.classList.add('hidden');
    });
}

async function handleChatRequest(requestId, action, senderId = null, senderUsername = null, chatId = null) {
    const requestDocRef = doc(db, `artifacts/${appId}/chat_requests`, requestId);

    try {
        if (action === 'accept') {
            const currentActiveCount = Object.keys(activePrivateChats).length;
            if (currentActiveCount >= 3) {
                showMessageBox("Batas obrolan pribadi Anda penuh. Harap hapus obrolan yang ada sebelum menerima permintaan baru.", 'warning', privateChatMessageBox, privateChatErrorMessage);
                return;
            }

            await runTransaction(db, async (transaction) => {
                const requestDoc = await transaction.get(requestDocRef);
                if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
                    throw new Error("Permintaan tidak valid atau sudah diproses.");
                }

                // Update request status
                transaction.update(requestDocRef, { status: 'accepted', acceptedAt: serverTimestamp() });
                chatRequestsDB.removeItem(requestId); // Remove from cache

                // Ensure private chat document exists (it should have been created by sender)
                const privateChatDocRef = doc(db, `artifacts/${appId}/private_chats`, chatId);
                const privateChatDoc = await transaction.get(privateChatDocRef);
                if (!privateChatDoc.exists()) {
                     // This case ideally shouldn't happen if sender created it, but as a fallback
                    const participants = [senderId, userId].sort();
                    transaction.set(privateChatDocRef, {
                        participants: participants,
                        createdAt: serverTimestamp(),
                        lastMessageAt: serverTimestamp(),
                        participantNames: {
                            [senderId]: senderUsername,
                            [userId]: username
                        }
                    });
                }
            });
            showMessageBox(`Permintaan dari ${senderUsername} diterima!`, 'success', privateChatMessageBox, privateChatErrorMessage);
            // Optionally, navigate to the new chat
            selectPrivateChat(chatId, senderId, senderUsername);

        } else if (action === 'deny') {
            await deleteDoc(requestDocRef);
            chatRequestsDB.removeItem(requestId); // Remove from cache
            showMessageBox("Permintaan obrolan ditolak.", 'success', privateChatMessageBox, privateChatErrorMessage);
        }
    } catch (error) {
        console.error(`Gagal menangani permintaan obrolan (${action}):`, error);
        showMessageBox(`Gagal ${action === 'accept' ? 'menerima' : 'menolak'} permintaan.`, 'error', privateChatMessageBox, privateChatErrorMessage);
    }
}


// --- Logika Profil ---
let userProfileListener;

async function loadUserProfile() {
    if (userProfileListener) userProfileListener(); // Berhenti berlangganan listener sebelumnya

    if (!userId) {
        profileUsernameDisplay.textContent = 'N/A';
        profileUserIdDisplay.textContent = 'N/A';
        profileMessageCountDisplay.textContent = '0';
        return;
    }

    const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
    userProfileListener = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            username = userData.username; // Perbarui nama pengguna global
            userRandomId = userData.randomUserId; // Perbarui ID acak global
            userRole = userData.role || 'user'; // Perbarui peran pengguna global

            profileUsernameDisplay.textContent = userData.username || 'Belum Diatur';
            profileUserIdDisplay.textContent = userData.randomUserId || 'Belum Diatur';
            profileMessageCountDisplay.textContent = userData.messageCount || 0;

            newUsernameInput.value = userData.username || ''; // Set current username in update field
        } else {
            console.warn("Profil pengguna tidak ditemukan di Firestore.");
            profileUsernameDisplay.textContent = 'Tidak Ditemukan';
            profileUserIdDisplay.textContent = userId;
            profileMessageCountDisplay.textContent = '0';
            // If profile not found, it might be a new user from an older auth method, create one
            if (auth.currentUser) {
                const randomId = generateRandomUserId();
                setDoc(userDocRef, {
                    email: auth.currentUser.email,
                    username: auth.currentUser.email.split('@')[0],
                    randomUserId: randomId,
                    createdAt: serverTimestamp(),
                    messageCount: 0,
                    role: 'user' // Default role
                }).then(() => {
                    console.log("Profil pengguna dibuat secara otomatis.");
                    username = auth.currentUser.email.split('@')[0];
                    userRandomId = randomId;
                    userRole = 'user';
                    profileUsernameDisplay.textContent = username;
                    profileUserIdDisplay.textContent = userRandomId;
                }).catch(e => console.error("Gagal membuat profil pengguna:", e));
            }
        }
    }, (error) => {
        console.error("Gagal memuat profil pengguna:", error);
        profileUsernameDisplay.textContent = 'Kesalahan';
        profileUserIdDisplay.textContent = 'Kesalahan';
        profileMessageCountDisplay.textContent = 'Kesalahan';
    });
}

async function updateUsername() {
    const newName = newUsernameInput.value.trim();
    if (!newName) {
        showMessageBox('Nama pengguna tidak boleh kosong.', 'warning', profileUpdateMessage, profileUpdateMessage);
        return;
    }
    if (newName === username) {
        showMessageBox('Nama pengguna baru sama dengan yang lama.', 'warning', profileUpdateMessage, profileUpdateMessage);
        return;
    }

    try {
        // Update username in Auth profile (if needed, though not directly used for display in this app)
        await updateProfile(auth.currentUser, { displayName: newName });

        // Update username in Firestore profile
        const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
        await updateDoc(userDocRef, { username: newName });

        // Also update username in any active private chats where this user is a participant
        const privateChatsQuery = query(collection(db, `artifacts/${appId}/private_chats`), where('participants', 'array-contains', userId));
        const privateChatsSnapshot = await getDocs(privateChatsQuery);
        const updatePromises = [];
        privateChatsSnapshot.forEach(chatDoc => {
            const participantNames = chatDoc.data().participantNames;
            if (participantNames[userId] !== newName) { // Only update if different
                participantNames[userId] = newName;
                updatePromises.push(updateDoc(doc(db, `artifacts/${appId}/private_chats`, chatDoc.id), { participantNames: participantNames }));
            }
        });
        await Promise.all(updatePromises);


        username = newName; // Update global variable
        showMessageBox('Nama pengguna berhasil diperbarui!', 'success', profileUpdateMessage, profileUpdateMessage);
    } catch (error) {
        console.error("Kesalahan saat memperbarui nama pengguna:", error);
        showMessageBox('Gagal memperbarui nama pengguna: ' + error.message, 'error', profileUpdateMessage, profileUpdateMessage);
    }
}

// Renamed function to avoid conflict with Firebase SDK's updatePassword
async function updateUserPassword() {
    const newPass = newPasswordInput.value.trim();
    if (!newPass || newPass.length < 6) {
        showMessageBox('Kata sandi baru harus minimal 6 karakter.', 'warning', profileUpdateMessage, profileUpdateMessage);
        return;
    }

    try {
        // Re-authenticate user first (required for password changes)
        // For simplicity, we'll prompt for current password here. In a real app, you'd have a dedicated re-auth flow.
        const currentPassword = prompt("Untuk memperbarui kata sandi, harap masukkan kata sandi Anda saat ini:");
        if (!currentPassword) {
            showMessageBox('Pembaharuan kata sandi dibatalkan.', 'warning', profileUpdateMessage, profileUpdateMessage);
            return;
        }

        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPass); // Using the Firebase SDK updatePassword
        showMessageBox('Kata sandi berhasil diperbarui!', 'success', profileUpdateMessage, profileUpdateMessage);
        newPasswordInput.value = ''; // Clear password field
    } catch (error) {
        console.error("Kesalahan saat memperbarui kata sandi:", error);
        let errorMessage = 'Gagal memperbarui kata sandi: ' + error.message;
        if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Untuk memperbarui kata sandi, Anda harus login kembali. Silakan logout dan login lagi, lalu coba perbarui kata sandi Anda.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Kata sandi saat ini salah. Harap masukkan kata sandi Anda yang benar untuk mengonfirmasi perubahan.';
        }
        showMessageBox(errorMessage, 'error', profileUpdateMessage, profileUpdateMessage);
    }
}

// Fungsi untuk menampilkan profil pengguna lain
async function displayOtherUserProfile(targetUserId, targetUsername) {
    if (targetUserId === userId) {
        // If trying to view own profile, just show own profile page
        showPage(profilePage);
        return;
    }

    foundUserProfile.classList.remove('hidden');
    foundUsernameDisplay.textContent = targetUsername;
    foundUserIdDisplay.textContent = 'Memuat ID...'; // Placeholder
    sendPmRequestBtn.classList.remove('hidden'); // Ensure button is visible
    sendPmRequestMessage.classList.add('hidden'); // Hide previous messages

    try {
        const userDoc = await getDoc(doc(db, `artifacts/${appId}/users`, targetUserId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            foundUserIdDisplay.textContent = userData.randomUserId || 'Tidak Ditemukan';
            sendPmRequestBtn.dataset.recipientId = targetUserId;
            sendPmRequestBtn.dataset.recipientUsername = targetUsername;
        } else {
            foundUserIdDisplay.textContent = 'Tidak Ditemukan';
            sendPmRequestBtn.classList.add('hidden'); // Hide button if user not found
            showMessageBox('Profil pengguna tidak ditemukan.', 'error', findUserMessage, findUserMessage);
        }
    } catch (error) {
        console.error("Kesalahan saat mengambil profil pengguna lain:", error);
        foundUserIdDisplay.textContent = 'Kesalahan';
        sendPmRequestBtn.classList.add('hidden');
        showMessageBox('Gagal memuat profil pengguna.', 'error', findUserMessage, findUserMessage);
    }
}

// Fungsi Cari Pengguna
async function findUser() {
    const queryText = findUserInput.value.trim();
    if (!queryText) {
        showMessageBox('Silakan masukkan nama pengguna atau ID pengguna untuk mencari.', 'warning', findUserMessage, findUserMessage);
        foundUserProfile.classList.add('hidden');
        return;
    }

    foundUserProfile.classList.add('hidden'); // Hide previous results
    findUserMessage.classList.remove('hidden');
    findUserMessage.textContent = 'Mencari...';
    findUserMessage.classList.remove('bg-red-100', 'bg-yellow-100', 'bg-green-100', 'text-red-700', 'text-yellow-700', 'text-green-700');
    findUserMessage.classList.add('bg-gray-100', 'text-gray-700');


    try {
        let userFound = false;
        let targetUserId = null;
        let targetUsername = null;

        // Try to find by randomUserId first
        const usersRef = collection(db, `artifacts/${appId}/users`);
        let q = query(usersRef, where('randomUserId', '==', queryText.toUpperCase()));
        let snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            if (userDoc.id === userId) {
                showMessageBox('Itu profil Anda sendiri!', 'warning', findUserMessage, findUserMessage);
                showPage(profilePage); // Navigate to own profile
                return;
            }
            targetUserId = userDoc.id;
            targetUsername = userDoc.data().username;
            userFound = true;
        } else {
            // If not found by randomUserId, try by username (case-sensitive for simplicity)
            q = query(usersRef, where('username', '==', queryText));
            snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                if (userDoc.id === userId) {
                    showMessageBox('Itu profil Anda sendiri!', 'warning', findUserMessage, findUserMessage);
                    showPage(profilePage); // Navigate to own profile
                    return;
                }
                targetUserId = userDoc.id;
                targetUsername = userDoc.data().username;
                userFound = true;
            }
        }

        if (userFound) {
            displayOtherUserProfile(targetUserId, targetUsername);
            findUserMessage.classList.add('hidden'); // Hide "Searching..." message
        } else {
            showMessageBox('Pengguna tidak ditemukan.', 'error', findUserMessage, findUserMessage);
        }
    } catch (error) {
        console.error("Kesalahan saat mencari pengguna:", error);
        showMessageBox('Gagal mencari pengguna.', 'error', findUserMessage, findUserMessage);
    }
}

// --- Logika Iklan (Placeholder) ---

// Placeholder untuk menampilkan iklan banner
function showBannerAd() {
    // Di aplikasi web nyata, Anda akan menyisipkan kode AdSense/AdMob di sini.
    // Untuk aplikasi Android yang dibungkus, ini akan menggunakan plugin Capacitor/Cordova AdMob.
    console.log("Menampilkan iklan banner.");
    // bannerAd.innerHTML = '<img src="https://placehold.co/320x50/FFD700/000000?text=Iklan+Aktual" alt="Iklan Banner">';
    // NOTE: For the banner ad to be static and unscrollable, you would typically apply
    // CSS styling to its container (e.g., `position: fixed; bottom: 0; width: 100%; z-index: 1000;`).
    // This is a CSS/HTML layout concern, not directly handled in JavaScript logic.
    /*
    if (window.adsbygoogle && window.adsbygoogle.length > 0) {
        (adsbygoogle = window.adsbygoogle || []).push({});
    }
    */
}

// Placeholder untuk menampilkan iklan interstitial
function showInterstitialAd() {
    console.log("Menampilkan iklan interstitial (simulasi).");
    showMessageBox("Menampilkan iklan interstitial... (Simulasi)", 'info', authError, authErrorMessage, 3000); // Use authError for general messages
    // Di aplikasi nyata, ini akan memanggil SDK AdMob
    /*
    if (window.AdMob) {
        AdMob.prepareInterstitial({
            adId: 'ca-app-pub-YOUR_ADMOB_INTERSTITIAL_AD_ID/XXXXXXXXXX',
            is
        });
        AdMob.showInterstitial();
    }
    */
}

// --- Logika Papan Buletin ---
let bulletinListener;

async function listenForBulletinUpdates() {
    if (bulletinListener) bulletinListener(); // Stop previous listener if any

    bulletinBoard.innerHTML = `<p class="text-center text-gray-500 italic">Memuat pengumuman...</p>`;
    const bulletinRef = collection(db, `artifacts/${appId}/public/data/bulletin`);
    const q = query(bulletinRef, orderBy('timestamp', 'desc')); // Order by latest

    bulletinListener = onSnapshot(q, (snapshot) => {
        bulletinBoard.innerHTML = ''; // Clear existing content
        if (snapshot.empty) {
            bulletinBoard.innerHTML = `<p class="text-center text-gray-500 italic">Belum ada pengumuman.</p>`;
            return;
        }
        snapshot.forEach(docSnap => {
            const bulletinData = docSnap.data();
            const displayDate = getDisplayDate(bulletinData.timestamp);
            const formattedDate = displayDate ? displayDate.toLocaleDateString() : 'Tanggal tidak diketahui';

            const bulletinItem = document.createElement('div');
            bulletinItem.classList.add('bg-white', 'p-4', 'rounded-lg', 'shadow-md', 'mb-4');
            bulletinItem.innerHTML = `
                <h3 class="font-bold text-lg text-gray-800">${bulletinData.title || 'Tanpa Judul'}</h3>
                <p class="text-gray-700 mt-2">${bulletinData.content || 'Tidak ada konten.'}</p>
                <p class="text-sm text-gray-500 mt-2">Diterbitkan: ${formattedDate}</p>
            `;
            bulletinBoard.appendChild(bulletinItem);
        });
    }, (error) => {
        console.error("Gagal memuat pengumuman papan buletin:", error);
        bulletinBoard.innerHTML = `<p class="text-center text-red-500 italic">Gagal memuat pengumuman.</p>`;
    });
}


// --- Event Listeners ---

// Halaman Autentikasi
authSubmitBtn.addEventListener('click', handleAuth);
toggleAuthBtn.addEventListener('click', toggleAuthMode);
// logoutBtn.addEventListener('click', handleLogout); // Moved to profile area

// Navigasi
navForum.addEventListener('click', () => showPage(forumPage));
navEkspor101.addEventListener('click', () => showPage(ekspor101Page));
navPrivateChat.addEventListener('click', () => showPage(privateChatPage));
navProfile.addEventListener('click', () => showPage(profilePage));
navDonate.addEventListener('click', () => showPage(donatePage));

// Forum
forumMessageForm.addEventListener('submit', sendForumMessage);
loadMoreForumMessagesBtn.addEventListener('click', loadOlderForumMessages);

// Obrolan Pribadi
privateMessageForm.addEventListener('submit', sendPrivateMessage);

// Profil
updateUsernameBtn.addEventListener('click', updateUsername);
updateUserPasswordBtn.addEventListener('click', updateUserPassword); // Updated to new function name
findUserBtn.addEventListener('click', findUser);
sendPmRequestBtn.addEventListener('click', async () => {
    const recipientId = sendPmRequestBtn.dataset.recipientId;
    const recipientUsername = sendPmRequestBtn.dataset.recipientUsername;
    if (recipientId && recipientUsername) {
        const success = await startPrivateChat(recipientId, recipientUsername);
        if (success) {
            // Optionally, navigate to private chat page
            showPage(privateChatPage);
        }
    } else {
        showMessageBox('Penerima tidak valid.', 'error', sendPmRequestMessage, sendPmRequestMessage);
    }
});
profileLogoutBtn.addEventListener('click', handleLogout); // New: Event listener for logout button in profile

// Donasi
contactSupportBtn.addEventListener('click', () => {
    window.location.href = 'mailto:support@ekspor101.com?subject=Dukungan Aplikasi Ekspor 101';
});


// --- Inisialisasi Aplikasi ---

// New function to initialize Firebase and handle auth state
async function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                // Fetch user profile from Firestore to get username, randomUserId, and role
                const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    username = userData.username;
                    userRandomId = userData.randomUserId;
                    userRole = userData.role || 'user'; // Set user role
                    // If username is null/undefined in Firestore, use email part as fallback
                    if (!username) {
                        username = user.email ? user.email.split('@')[0] : 'Anonim';
                        await updateDoc(userDocRef, { username: username });
                    }
                    // If randomUserId is null/undefined, generate and save
                    if (!userRandomId) {
                        userRandomId = generateRandomUserId();
                        await updateDoc(userDocRef, { randomUserId: userRandomId });
                    }
                } else {
                    // User exists in Auth but not in Firestore (e.g., first login after old data wipe)
                    username = user.email ? user.email.split('@')[0] : 'Anonim';
                    userRandomId = generateRandomUserId();
                    userRole = 'user'; // Default role
                    await setDoc(userDocRef, {
                        email: user.email,
                        username: username,
                        randomUserId: userRandomId,
                        createdAt: serverTimestamp(),
                        messageCount: 0,
                        role: userRole
                    });
                    console.log("Profil pengguna Firestore dibuat secara otomatis untuk pengguna yang sudah ada di Auth.");
                }

                // Show main app and hide auth page
                authPage.classList.add('hidden');
                mainApp.classList.remove('hidden');
                userIdDisplay.classList.add('hidden'); // Keep this hidden as per request for top header

                // Set initial page to Profile
                showPage(profilePage);
                showBannerAd(); // Show banner ad on app load

            } else {
                // User is signed out
                userId = null;
                username = null;
                userRandomId = null;
                userRole = 'user'; // Reset role
                authPage.classList.remove('hidden');
                mainApp.classList.add('hidden');
                userIdDisplay.classList.add('hidden');

                // Stop all listeners when user logs out
                if (forumMessagesListener) forumMessagesListener();
                if (allUsersListener) allUsersListener();
                if (activePrivateChatListener) activePrivateChatListener();
                if (privateChatsListener) privateChatsListener();
                if (incomingChatRequestsListener) incomingChatRequestsListener();
                if (userProfileListener) userProfileListener();
                if (bulletinListener) bulletinListener(); // Stop bulletin listener
            }
        });
    } catch (error) {
        console.error("Gagal menginisialisasi Firebase:", error);
        showMessageBox("Gagal menginisialisasi aplikasi. Coba lagi nanti.", 'error', authError, authErrorMessage, 10000);
    }
}

window.onload = initializeFirebase;
