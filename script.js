// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // Corrected URL
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyChcepu7datc3t3Lc_35-5Kx2ifa9uYv3I",
    authDomain: "ekspor-101.firebaseapp.com",
    projectId: "ekspor-101",
    storageBucket: "ekspor-101.firebasestorage.app",
    messagingSenderId: "148602540055",
    appId: "1:148602540055:web:2d318d8c11ae7b297e4c52",
    measurementId: "G-KHTXXW8F9Y"
};

// Global variables for Firebase app ID (derived from projectId for consistency)
const appId = firebaseConfig.projectId;

// Firebase App and Services
let app;
let db;
let auth;
let userId = null; // Will be set after authentication
let username = null; // Will be set from user profile in Firestore

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
const logoutBtn = document.getElementById('logoutBtn');
const userIdDisplay = document.getElementById('userIdDisplay');
const currentUserIdDisplay = document.getElementById('currentUserId');

// Navigation Buttons
const navForum = document.getElementById('navForum');
const navEkspor101 = document.getElementById('navEkspor101');
const navPrivateChat = document.getElementById('navPrivateChat');
const navProfile = document.getElementById('navProfile');
const navDonate = document.getElementById('navDonate');
const navButtons = [navForum, navEkspor101, navPrivateChat, navProfile, navDonate];

// Page Content Areas
const forumPage = document.getElementById('forumPage');
const ekspor101Page = document.getElementById('ekspor101Page');
const privateChatPage = document.getElementById('privateChatPage');
const profilePage = document.getElementById('profilePage');
const donatePage = document.getElementById('donatePage');
const pageContents = [forumPage, ekspor101Page, privateChatPage, profilePage, donatePage];

// Forum Elements
const forumMessages = document.getElementById('forumMessages');
const forumMessageInput = document.getElementById('forumMessageInput');
const forumMessageForm = document.getElementById('forumMessageForm');
const onlineCountDisplay = document.getElementById('onlineCount');

// Private Chat Elements
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
let activePrivateChatId = null; // Stores the ID of the currently active private chat
let activePrivateChatListener = null; // Stores the unsubscribe function for private chat messages
let activePrivateChats = {}; // Stores details of active private chats {recipientId: {chatId, recipientId, recipientName}}

// Profile Elements
const profileUsernameDisplay = document.getElementById('profileUsername');
const profileUserIdDisplay = document.getElementById('profileUserId');
const profileMessageCountDisplay = document.getElementById('profileMessageCount');

// --- Utility Functions ---

// Function to scroll chat to bottom
function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

// Function to display a message in the chat UI
function displayChatMessage(message, targetElement, isPrivate = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('flex', 'items-start', 'space-x-2');

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

    messageElement.innerHTML = `
        <div class="flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}">
            <span class="${nameClasses}">${message.username || 'Anonymous'}</span>
            <div class="${bubbleClasses}">
                <p class="${textClasses}">${message.text}</p>
                <span class="text-xs ${isCurrentUser ? 'text-blue-300' : 'text-gray-500'} mt-1 block">
                    ${message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                </span>
            </div>
        </div>
    `;
    targetElement.appendChild(messageElement);
    scrollToBottom(targetElement);
}

// Function to show custom message box (replaces alert)
function showMessageBox(message, type = 'error', targetElement = authError, targetMessageElement = authErrorMessage) {
    targetMessageElement.textContent = message;
    targetElement.classList.remove('hidden', 'bg-red-100', 'bg-yellow-100', 'border-red-400', 'border-yellow-400', 'text-red-700', 'text-yellow-700');
    if (type === 'error') {
        targetElement.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
    } else if (type === 'warning') {
        targetElement.classList.add('bg-yellow-100', 'border-yellow-400', 'text-yellow-700');
    } else if (type === 'success') {
        targetElement.classList.add('bg-green-100', 'border-green-400', 'text-green-700'); // Added success styling
    }
    setTimeout(() => {
        targetElement.classList.add('hidden');
    }, 5000); // Hide after 5 seconds
}


// --- Authentication Logic ---

async function handleAuth() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessageBox('Please enter both email and password.', 'error');
        return;
    }

    try {
        if (currentAuthMode === 'register') {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            // Store user profile data in Firestore
            await setDoc(doc(db, `artifacts/${appId}/users`, user.uid), {
                email: user.email,
                username: email.split('@')[0], // Default username from email
                createdAt: serverTimestamp(),
                messageCount: 0 // Initialize message count
            });
            username = email.split('@')[0]; // Set global username
            showMessageBox('Registration successful! You are now logged in.', 'success', authError, authErrorMessage);
        } else { // currentAuthMode === 'login'
            await signInWithEmailAndPassword(auth, email, password);
            showMessageBox('Login successful!', 'success', authError, authErrorMessage);
        }
    } catch (error) {
        console.error("Auth error:", error);
        let errorMessage = "An unknown error occurred.";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Try logging in.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password login is not enabled. Please contact support.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters.';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid email or password.';
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
        authTitle.textContent = 'Register';
        authSubmitBtn.textContent = 'Register';
        toggleAuthBtn.textContent = 'Already have an account? Login';
    } else {
        currentAuthMode = 'login';
        authTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        toggleAuthBtn.textContent = 'Don\'t have an account? Register';
    }
    authError.classList.add('hidden'); // Hide error message on mode switch
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("User logged out.");
        // Clear local storage username if it's tied to this session
        localStorage.removeItem('chatUsername');
        // Hide main app, show auth page
        mainApp.classList.add('hidden');
        userIdDisplay.classList.add('hidden');
        authPage.classList.remove('hidden');
        // Clear inputs
        emailInput.value = '';
        passwordInput.value = '';
        // Reset to login mode
        currentAuthMode = 'login';
        authTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        toggleAuthBtn.textContent = 'Don\'t have an account? Register';

        // Stop all listeners
        if (forumMessagesListener) forumMessagesListener();
        if (onlineUsersListener) onlineUsersListener();
        if (allUsersListener) allUsersListener();
        if (activePrivateChatListener) activePrivateChatListener();
        if (privateChatsListener) privateChatsListener();
        if (userProfileListener) userProfileListener();

    } catch (error) {
        console.error("Error logging out:", error);
        showMessageBox("Error logging out.", 'error');
    }
}

// --- Navigation Logic ---

function showPage(pageToShow) {
    pageContents.forEach(page => {
        page.classList.add('hidden');
    });
    pageToShow.classList.remove('hidden');

    navButtons.forEach(btn => {
        btn.classList.remove('active', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });

    // Add active class to the clicked button
    if (pageToShow === forumPage) navForum.classList.add('active', 'text-blue-600');
    else if (pageToShow === ekspor101Page) navEkspor101.classList.add('active', 'text-blue-600');
    else if (pageToShow === privateChatPage) navPrivateChat.classList.add('active', 'text-blue-600');
    else if (pageToShow === profilePage) navProfile.classList.add('active', 'text-blue-600');
    else if (pageToShow === donatePage) navDonate.classList.add('active', 'text-blue-600');

    // Specific actions when showing pages
    if (pageToShow === forumPage) {
        listenForForumMessages();
        setupOnlinePresence();
    } else {
        if (forumMessagesListener) forumMessagesListener(); // Unsubscribe
        if (onlineUsersListener) onlineUsersListener(); // Unsubscribe
    }

    if (pageToShow === privateChatPage) {
        loadAllMembers();
        listenForActivePrivateChats();
    } else {
        if (allUsersListener) allUsersListener(); // Unsubscribe
        if (privateChatsListener) privateChatsListener(); // Unsubscribe
        if (activePrivateChatListener) { // Unsubscribe from current private chat if active
            activePrivateChatListener();
            activePrivateChatListener = null;
            selectedPrivateChatView.classList.add('hidden');
        }
    }

    if (pageToShow === profilePage) {
        loadUserProfile();
    } else {
        if (userProfileListener) userProfileListener(); // Unsubscribe
    }
}

// --- Forum Chat Logic ---
let forumMessagesListener;
let onlineUsersListener;

function listenForForumMessages() {
    if (forumMessagesListener) forumMessagesListener(); // Unsubscribe previous listener if exists

    forumMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Loading forum messages...</div>`;
    const messagesRef = collection(db, `artifacts/${appId}/public/data/forum_messages`);
    const q = query(messagesRef, orderBy('timestamp'));

    forumMessagesListener = onSnapshot(q, (snapshot) => {
        forumMessages.innerHTML = ''; // Clear existing messages
        if (snapshot.empty) {
            forumMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">No messages yet. Be the first to send one!</div>`;
        }
        snapshot.forEach((doc) => {
            displayChatMessage(doc.data(), forumMessages);
        });
        scrollToBottom(forumMessages);
    }, (error) => {
        console.error("Error listening to forum messages:", error);
        forumMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Error loading forum messages.</div>`;
    });
}

async function sendForumMessage(e) {
    e.preventDefault();
    const text = forumMessageInput.value.trim();

    if (text && userId && username) {
        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/forum_messages`), {
                userId: userId,
                username: username,
                text: text,
                timestamp: serverTimestamp()
            });
            // Update user's message count in profile
            const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
            await updateDoc(userDocRef, {
                messageCount: (await getDoc(userDocRef)).data().messageCount + 1
            });
            forumMessageInput.value = '';
            scrollToBottom(forumMessages);
        } catch (e) {
            console.error("Error sending forum message: ", e);
            showMessageBox("Failed to send message.", 'error', forumMessages.parentElement); // Display error near chat
        }
    } else if (!username) {
        showMessageBox("Please set your username in profile or register first.", 'warning', forumMessages.parentElement);
    }
}

// Online Presence (Simplified)
async function setupOnlinePresence() {
    if (!userId || !username) return;

    const presenceRef = doc(db, `artifacts/${appId}/presence`, userId);
    // Set user as online
    await setDoc(presenceRef, {
        userId: userId,
        username: username,
        lastSeen: serverTimestamp(),
        status: 'online'
    }, { merge: true });

    // Listen for all online users
    const q = query(collection(db, `artifacts/${appId}/presence`), where('status', '==', 'online'));
    onlineUsersListener = onSnapshot(q, (snapshot) => {
        const onlineUsers = snapshot.docs.filter(doc => {
            const data = doc.data();
            // Consider user online if lastSeen is within the last 5 minutes
            return data.lastSeen && (Date.now() - data.lastSeen.toDate().getTime() < 5 * 60 * 1000);
        });
        onlineCountDisplay.textContent = `(${onlineUsers.length} Online)`;
    }, (error) => {
        console.error("Error listening to online users:", error);
    });

    // Mark user offline when they close the app/tab (best effort)
    window.addEventListener('beforeunload', async () => {
        if (userId) {
            await updateDoc(presenceRef, { status: 'offline', lastSeen: serverTimestamp() });
        }
    });
}


// --- Private Chat Logic ---
let allUsersListener;
let privateChatsListener;

async function loadAllMembers() {
    if (allUsersListener) allUsersListener(); // Unsubscribe previous listener if exists

    memberList.innerHTML = `<li class="text-gray-500 text-sm italic">Loading members...</li>`;
    const usersRef = collection(db, `artifacts/${appId}/users`);
    const q = query(usersRef, orderBy('username'));

    allUsersListener = onSnapshot(q, (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) {
            memberList.innerHTML = `<li class="text-gray-500 text-sm italic">No other members found.</li>`;
            return;
        }
        snapshot.forEach((userDoc) => {
            const memberData = userDoc.data();
            if (userDoc.id === userId) return; // Don't list current user

            const listItem = document.createElement('li');
            listItem.classList.add('p-2', 'bg-gray-50', 'rounded-lg', 'cursor-pointer', 'hover:bg-blue-100', 'transition', 'duration-200');
            listItem.textContent = memberData.username;
            listItem.dataset.userId = userDoc.id;
            listItem.dataset.username = memberData.username;
            listItem.addEventListener('click', () => startPrivateChat(userDoc.id, memberData.username));
            memberList.appendChild(listItem);
        });
    }, (error) => {
        console.error("Error loading members:", error);
        memberList.innerHTML = `<li class="text-red-500 text-sm italic">Error loading members.</li>`;
    });
}

async function startPrivateChat(recipientId, recipientName) {
    if (activePrivateChats[recipientId]) {
        // Chat already active, just switch to it
        selectPrivateChat(activePrivateChats[recipientId].chatId, recipientId, recipientName);
        return;
    }

    const currentActiveCount = Object.keys(activePrivateChats).length;
    if (currentActiveCount >= 3) {
        showMessageBox("You have reached the limit of 3 active private chats. Please delete an existing chat to start a new one.", 'warning', privateChatMessageBox, privateChatErrorMessage);
        return;
    }

    // Create a unique chat ID by sorting participant UIDs
    const participants = [userId, recipientId].sort();
    const chatId = participants.join('_');
    const chatRef = doc(db, `artifacts/${appId}/private_chats`, chatId);

    try {
        const chatDoc = await getDoc(chatRef);
        if (!chatDoc.exists()) {
            // Create new private chat document
            await setDoc(chatRef, {
                participants: participants,
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                participantNames: {
                    [userId]: username,
                    [recipientId]: recipientName
                }
            });
        }
        // Add to active chats and select it
        activePrivateChats[recipientId] = { chatId: chatId, recipientId: recipientId, recipientName: recipientName };
        updateActiveChatsUI();
        selectPrivateChat(chatId, recipientId, recipientName);

    } catch (error) {
        console.error("Error starting private chat:", error);
        showMessageBox("Failed to start private chat.", 'error', privateChatMessageBox, privateChatErrorMessage);
    }
}

function updateActiveChatsUI() {
    activeChatsContainer.innerHTML = '';
    activeChatCountDisplay.textContent = Object.keys(activePrivateChats).length;

    if (Object.keys(activePrivateChats).length === 0) {
        activeChatsContainer.innerHTML = `<span class="text-gray-500 text-sm italic">No active chats. Click a member to start one!</span>`;
        return;
    }

    for (const recipientId in activePrivateChats) {
        const chat = activePrivateChats[recipientId];
        const chatButton = document.createElement('button');
        chatButton.classList.add('bg-blue-200', 'hover:bg-blue-300', 'text-blue-800', 'font-semibold', 'py-2', 'px-4', 'rounded-full', 'flex', 'items-center', 'space-x-2', 'transition', 'duration-200', 'shadow-sm');
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

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-chat-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation(); // Prevent button click from also selecting chat
            const chatIdToDelete = button.dataset.chatId;
            const recipientIdToDelete = button.dataset.recipientId;
            deletePrivateChat(chatIdToDelete, recipientIdToDelete);
        };
    });
}

function selectPrivateChat(chatId, recipientId, recipientName) {
    if (activePrivateChatListener) {
        activePrivateChatListener(); // Unsubscribe from previous chat
    }
    activePrivateChatId = chatId;
    privateChatRecipientName.textContent = recipientName;
    selectedPrivateChatView.classList.remove('hidden');
    privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Loading private messages...</div>`;

    // Update active chat button styling
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
        privateChatMessages.innerHTML = '';
        if (snapshot.empty) {
            privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">No messages in this private chat yet.</div>`;
        }
        snapshot.forEach((doc) => {
            displayChatMessage(doc.data(), privateChatMessages, true);
        });
        scrollToBottom(privateChatMessages);
    }, (error) => {
        console.error("Error listening to private messages:", error);
        privateChatMessages.innerHTML = `<div class="text-center text-red-500 text-sm italic">Error loading private messages.</div>`;
    });
}

async function sendPrivateMessage(e) {
    e.preventDefault();
    const text = privateMessageInput.value.trim();

    if (text && userId && username && activePrivateChatId) {
        try {
            const messagesCollectionRef = collection(db, `artifacts/${appId}/private_chats/${activePrivateChatId}/messages`);
            await addDoc(messagesCollectionRef, {
                userId: userId,
                username: username,
                text: text,
                timestamp: serverTimestamp()
            });

            // Update lastMessageAt for the private chat document
            const chatDocRef = doc(db, `artifacts/${appId}/private_chats`, activePrivateChatId);
            await updateDoc(chatDocRef, {
                lastMessageAt: serverTimestamp()
            });

            privateMessageInput.value = '';
            scrollToBottom(privateChatMessages);
        } catch (e) {
            console.error("Error sending private message: ", e);
            showMessageBox("Failed to send private message.", 'error', privateChatMessageBox, privateChatErrorMessage);
        }
    }
}

async function deletePrivateChat(chatId, recipientId) {
    // Confirm with user (using a custom UI if this were a real app, for now just log)
    console.log(`Attempting to delete chat ${chatId} with ${recipientId}`);
    // In a real app, you'd show a modal here:
    if (!confirm(`Are you sure you want to delete the chat with ${activePrivateChats[recipientId].recipientName}? This cannot be undone.`)) {
        return;
    }

    try {
        // Unsubscribe from the chat if it's currently open
        if (activePrivateChatId === chatId && activePrivateChatListener) {
            activePrivateChatListener();
            activePrivateChatListener = null;
            activePrivateChatId = null;
            selectedPrivateChatView.classList.add('hidden'); // Hide chat view
            privateChatMessages.innerHTML = `<div class="text-center text-gray-500 text-sm italic">Select a chat or start a new one.</div>`;
        }

        // Delete all messages within the subcollection first
        const messagesRef = collection(db, `artifacts/${appId}/private_chats/${chatId}/messages`);
        const messageDocs = await getDocs(messagesRef);
        const deleteMessagePromises = [];
        messageDocs.forEach(msgDoc => {
            deleteMessagePromises.push(deleteDoc(doc(db, `artifacts/${appId}/private_chats/${chatId}/messages`, msgDoc.id)));
        });
        await Promise.all(deleteMessagePromises);

        // Then delete the private chat document itself
        await deleteDoc(doc(db, `artifacts/${appId}/private_chats`, chatId));

        // Remove from activePrivateChats object
        delete activePrivateChats[recipientId];
        updateActiveChatsUI(); // Refresh UI

        showMessageBox("Private chat deleted successfully.", 'success', privateChatMessageBox, privateChatErrorMessage);

    } catch (error) {
        console.error("Error deleting private chat:", error);
        showMessageBox("Failed to delete private chat.", 'error', privateChatMessageBox, privateChatErrorMessage);
    }
}


function listenForActivePrivateChats() {
    if (privateChatsListener) privateChatsListener(); // Unsubscribe previous listener

    // Listen for private chat documents where the current user is a participant
    const chatsRef = collection(db, `artifacts/${appId}/private_chats`);
    const q = query(chatsRef, where('participants', 'array-contains', userId), orderBy('lastMessageAt', 'desc'));

    privateChatsListener = onSnapshot(q, (snapshot) => {
        activePrivateChats = {}; // Reset active chats
        snapshot.forEach(doc => {
            const chatData = doc.data();
            const otherParticipantId = chatData.participants.find(pId => pId !== userId);
            const otherParticipantName = chatData.participantNames[otherParticipantId] || 'Unknown User';
            activePrivateChats[otherParticipantId] = {
                chatId: doc.id,
                recipientId: otherParticipantId,
                recipientName: otherParticipantName
            };
        });
        updateActiveChatsUI();
    }, (error) => {
        console.error("Error listening for active private chats:", error);
        showMessageBox("Error loading active private chats.", 'error', privateChatMessageBox, privateChatErrorMessage);
    });
}


// --- Profile Logic ---
let userProfileListener;

async function loadUserProfile() {
    if (userProfileListener) userProfileListener(); // Unsubscribe previous listener

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
            username = userData.username; // Update global username
            profileUsernameDisplay.textContent = userData.username || 'Not Set';
            profileUserIdDisplay.textContent = userId;
            profileMessageCountDisplay.textContent = userData.messageCount || 0;
        } else {
            console.warn("User profile not found in Firestore.");
            profileUsernameDisplay.textContent = 'Not Found';
            profileUserIdDisplay.textContent = userId;
            profileMessageCountDisplay.textContent = '0';
        }
    }, (error) => {
        console.error("Error loading user profile:", error);
        profileUsernameDisplay.textContent = 'Error';
        profileUserIdDisplay.textContent = 'Error';
        profileMessageCountDisplay.textContent = 'Error';
    });
}

// --- Firebase Initialization and Auth State Listener ---

async function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                userIdDisplay.classList.remove('hidden');
                currentUserIdDisplay.textContent = userId;
                mainApp.classList.remove('hidden');
                authPage.classList.add('hidden');
                console.log("User authenticated:", userId);

                // Load user profile and set username
                await loadUserProfile();
                // Show default page (Forum)
                showPage(forumPage);

            } else {
                userId = null;
                username = null;
                userIdDisplay.classList.add('hidden');
                mainApp.classList.add('hidden');
                authPage.classList.remove('hidden');
                console.log("User not authenticated.");
            }
        });
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showMessageBox("Failed to initialize app. Check console.", 'error');
    }
}

// --- Event Listeners ---

// Auth Page
authSubmitBtn.addEventListener('click', handleAuth);
toggleAuthBtn.addEventListener('click', toggleAuthMode);
logoutBtn.addEventListener('click', handleLogout);

// Navigation
navForum.addEventListener('click', () => showPage(forumPage));
navEkspor101.addEventListener('click', () => showPage(ekspor101Page));
navPrivateChat.addEventListener('click', () => showPage(privateChatPage));
navProfile.addEventListener('click', () => showPage(profilePage));
navDonate.addEventListener('click', () => showPage(donatePage));

// Forum
forumMessageForm.addEventListener('submit', sendForumMessage);

// Private Chat
privateMessageForm.addEventListener('submit', sendPrivateMessage);


// --- Initialize App ---
window.onload = initializeFirebase;
