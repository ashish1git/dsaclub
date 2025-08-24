// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// The Html5QrcodeScanner library is expected to be loaded via a <script> tag in the HTML.
// No import statement is needed here.

// Your specific Firebase configuration.
const firebaseConfig = {
    apiKey: "AIzaSyDyNXHZbUtQ46TttMKZrianr5UVt_HVLNg",
    authDomain: "dsaportal-5ae69.firebaseapp.com",
    projectId: "dsaportal-5ae69",
    storageBucket: "dsaportal-5ae69.appspot.com",
    messagingSenderId: "866319233706",
    appId: "1:866319233706:web:713c4b63de7f1b159656d3",
    measurementId: "G-KVN5F00EGJ"
};

// --- GLOBAL VARIABLES ---
let app, auth, db;
let unsubscribeFromHistory; // Global variable to hold the unsubscribe function for attendance history listener
let currentModalPromiseResolve;
let html5QrCodeScanner;
let currentUserProfile;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("!!! FATAL ERROR: Could not initialize Firebase. Check your firebaseConfig object. !!!", e);
    document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; padding: 50px;">Error: Could not connect to the server. Please check your Firebase configuration.</div>';
}

// --- MODAL UTILITY FUNCTIONS ---
/**
 * Displays a custom modal alert.
 * @param {string} message - The message to display.
 * @param {string} title - The title of the modal.
 */
function showAlert(message, title = "Alert") {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalButtons = document.getElementById('modal-buttons');

    if (!modal || !modalTitle || !modalMessage || !modalButtons) {
        console.error("Modal elements not found. Falling back to native alert.");
        window.alert(message);
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = `<button id="modal-ok-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">OK</button>`;
    modal.classList.remove('hidden');

    const okBtn = document.getElementById('modal-ok-btn');
    okBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    }, { once: true });
}

/**
 * Displays a custom modal confirm dialog.
 * @param {string} message - The message to display.
 * @param {string} title - The title of the modal.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
function showConfirm(message, title = "Confirm") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalButtons = document.getElementById('modal-buttons');

        if (!modal || !modalTitle || !modalMessage || !modalButtons) {
            console.error("Modal elements not found. Falling back to native confirm.");
            resolve(window.confirm(message));
            return;
        }
        
        // Remove previous listeners to prevent duplicates
        modalButtons.innerHTML = `
            <button id="modal-confirm-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Confirm</button>
            <button id="modal-cancel-btn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancel</button>
        `;

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.remove('hidden');

        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        const cleanup = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };

        const onConfirm = () => {
            resolve(true);
            cleanup();
        };

        const onCancel = () => {
            resolve(false);
            cleanup();
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}


// --- HELPER FUNCTIONS ---
/**
 * Fetches a user's profile from the 'users' collection.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} The user profile data or null if not found.
 */
async function getUserProfile(uid) {
    if (!uid) return null;
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        console.warn(`No user profile found for UID: ${uid}`);
        return null;
    }
    return { id: userDocSnap.id, ...userDocSnap.data() };
}

/**
 * Calculates the duration between two time strings in hours.
 * @param {string} startTime - The start time string (e.g., "12:50").
 * @param {string} endTime - The end time string (e.g., "15:00").
 * @returns {number|null} The duration in hours, rounded to two decimal places, or null on invalid input.
 */
function calculateDurationInHours(startTime, endTime) {
    if (!startTime || !endTime) return null;
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    let startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;
    if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60;
    }
    const durationInMinutes = endTotalMinutes - startTotalMinutes;
    return Math.round((durationInMinutes / 60) * 100) / 100;
}

/**
 * Formats a time string into 12-hour format with AM/PM.
 * @param {string} timeString - The time string (e.g., "13:30").
 * @returns {string} The formatted time string (e.g., "1:30 PM").
 */
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/**
 * Plays a short beep sound.
 */
function playBeep() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gainNode.gain.setValueAtTime(0.5, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.5);
}

/**
 * Formats a date string to DD/MM/YYYY.
 * @param {string} dateString - The date string (e.g., "2025-08-23").
 * @returns {string} The formatted date (e.g., "23/08/2025").
 */
function formatDateDDMMYYYY(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Calculates the distance between two geographical coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 * @returns {number} The distance in meters.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// --- MAIN INITIALIZATION LOGIC ---
window.addEventListener('load', () => {
    setupMatrixAnimation();
    setupAdminTabs();
    setupAuthForms();

    onAuthStateChanged(auth, async (user) => {
        const currentPage = window.location.pathname.split("/").pop();
        if (user) {
            currentUserProfile = await getUserProfile(user.uid);
            if (currentUserProfile && currentUserProfile.role === 'admin') {
                if (currentPage !== 'admin.html') { window.location.href = 'admin.html'; return; }
                initAdminDashboardLogic(db);
            } else if (currentUserProfile && currentUserProfile.role === 'student') {
                if (currentPage !== 'dashboard.html' && currentPage !== 'scanner.html') { window.location.href = 'dashboard.html'; return; }
                if (currentPage === 'dashboard.html') initStudentDashboard(currentUserProfile, db);
                else if (currentPage === 'scanner.html') initQrScanner();
            } else {
                console.error("Logged in user has no profile. Logging out.");
                await signOut(auth);
                return;
            }
        } else {
            const protectedPages = ['dashboard.html', 'admin.html', 'scanner.html'];
            if (protectedPages.includes(currentPage)) window.location.href = 'index.html';
        }
    });

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => await signOut(auth));
    }
});

// --- UI & ANIMATION ---
/**
 * Sets up a particle animation on a canvas element.
 */
function setupMatrixAnimation() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particlesArray;

    const numParticles = 100;
    const maxDistance = 120;
    const particleColor = 'rgba(59, 130, 246, 0.6)';

    function init() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particlesArray = [];
        for (let i = 0; i < numParticles; i++) {
            particlesArray.push(new Particle());
        }
    }

    function Particle() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.directionX = Math.random() * 0.4 - 0.2;
        this.directionY = Math.random() * 0.4 - 0.2;
        this.size = 2;
        this.color = particleColor;
    }

    Particle.prototype.draw = function() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    Particle.prototype.update = function() {
        if (this.x > canvas.width || this.x < 0) this.directionX *= -1;
        if (this.y > canvas.height || this.y < 0) this.directionY *= -1;
        this.x += this.directionX;
        this.y += this.directionY;
    }

    function animate() {
        requestAnimationFrame(animate);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
            for (let j = i; j < particlesArray.length; j++) {
                const distance = Math.sqrt(
                    Math.pow(particlesArray[i].x - particlesArray[j].x, 2) +
                    Math.pow(particlesArray[i].y - particlesArray[j].y, 2)
                );
                if (distance < maxDistance) {
                    ctx.strokeStyle = `rgba(59, 130, 246, ${1 - (distance / maxDistance)})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                    ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    window.addEventListener('resize', init);
    init();
    animate();
}

// --- AUTHENTICATION ---
/**
 * Sets up event listeners for the login and signup forms.
 */
function setupAuthForms() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            button.classList.add('btn-loading');
            button.disabled = true;

            const name = document.getElementById('signup-name')?.value;
            const email = document.getElementById('signup-email')?.value;
            const rollNo = document.getElementById('signup-roll')?.value;
            const moodleId = document.getElementById('signup-moodle')?.value;
            const division = document.getElementById('signup-division')?.value;
            const batch = document.getElementById('signup-batch')?.value;
            const password = document.getElementById('signup-password')?.value;
            const errorEl = document.getElementById('signup-error');
            if (errorEl) errorEl.textContent = '';

            try {
                const moodleQuery = query(collection(db, "users"), where("moodleId", "==", moodleId));
                const emailQuery = query(collection(db, "users"), where("email", "==", email));
                const moodleSnapshot = await getDocs(moodleQuery);
                const emailSnapshot = await getDocs(emailQuery);

                if (!moodleSnapshot.empty) {
                    throw new Error("Moodle ID is already registered.");
                }
                if (!emailSnapshot.empty) {
                    throw new Error("Email is already registered.");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name, email, rollNo, moodleId, division, batch, role: 'student'
                });

                window.location.href = 'dashboard.html';
            } catch (error) {
                if (errorEl) errorEl.textContent = error.message.replace('Firebase: ', '');
                button.classList.remove('btn-loading');
                button.disabled = false;
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const passwordInput = document.getElementById('login-password');
        const showPasswordToggle = document.getElementById('show-password-toggle');

        if (showPasswordToggle && passwordInput) {
            showPasswordToggle.addEventListener('change', () => {
                passwordInput.type = showPasswordToggle.checked ? 'text' : 'password';
            });
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            button.classList.add('btn-loading');
            button.disabled = true;

            const identifier = document.getElementById('login-identifier')?.value;
            const password = document.getElementById('login-password')?.value;
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';

            try {
                let loginEmail = identifier;
                if (!identifier.includes('@')) {
                    const q = query(collection(db, "users"), where("moodleId", "==", identifier));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        throw new Error("Moodle ID not found.");
                    }
                    const studentData = querySnapshot.docs[0].data();
                    if (!studentData.email) {
                        throw new Error("Account data is incomplete. Please ask the student to register.");
                    }
                    loginEmail = studentData.email;
                }
                
                await signInWithEmailAndPassword(auth, loginEmail, password);
            } catch (error) {
                console.error("Login Error:", error);
                if (errorEl) errorEl.textContent = "Invalid credential or password.";
                button.classList.remove('btn-loading');
                button.disabled = false;
            }
        });
    }
}


// --- STUDENT DASHBOARD ---
/**
 * Initializes the student dashboard UI and data loading.
 * @param {object} userData - The logged-in user's profile data.
 * @param {object} db - The Firestore database instance.
 */
async function initStudentDashboard(userData, db) {
    if (!userData) return;
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.innerHTML = `<h1 class="text-2xl sm:text-3xl md:text-4xl font-bold font-code text-blue-400">Welcome, ${userData.name}!</h1><p class="text-gray-400 mt-2 text-sm sm:text-base">Your Batch: <span class="font-bold text-green-400">${userData.division} - ${userData.batch}</span> | Lab: <span class="font-bold text-green-400">${userData.batch === 'Advanced' ? '407' : (userData.division === 'A' ? '406' : '405')}</span></p>`;
    }
    setupSidebarAndContent(userData, db);
    loadStudentStats(userData.id, userData.batch, db);
}

/**
 * Sets up the mobile sidebar and content tab switching for the student dashboard.
 * @param {object} userData - The user's profile data.
 * @param {object} db - The Firestore database instance.
 */
function setupSidebarAndContent(userData, db) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    const materialsBtn = document.querySelector('[data-target="materials-section"]');
    const problemsBtn = document.querySelector('[data-target="problems-section"]');
    const recordsBtn = document.querySelector('[data-target="records-section"]');

    const materialsSection = document.getElementById('materials-section');
    const problemsSection = document.getElementById('problems-section');
    const recordsSection = document.getElementById('records-section');
    
    // Ensure all elements exist before proceeding
    if (!sidebar || !overlay || !openBtn || !closeBtn || !materialsBtn || !problemsBtn || !recordsBtn || !materialsSection || !problemsSection || !recordsSection) {
        console.warn("Missing one or more dashboard UI elements.");
        return;
    }

    const sections = [
        { btn: materialsBtn, section: materialsSection, loadFunc: () => loadStudentMaterials(userData.batch, db) },
        { btn: problemsBtn, section: problemsSection, loadFunc: () => initProblemTracker(userData.id, db) },
        { btn: recordsBtn, section: recordsSection, loadFunc: () => loadStudentAttendance(userData.id, db) }
    ];

    const toggleSidebar = (show) => {
        if (show) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    };

    openBtn.addEventListener('click', () => toggleSidebar(true));
    closeBtn.addEventListener('click', () => toggleSidebar(false));
    overlay.addEventListener('click', () => toggleSidebar(false));

    if (sections[0]) sections[0].loadFunc();

    sections.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            sections.forEach(t => {
                t.section.classList.add('hidden');
                t.btn.classList.remove('active');
            });
            tab.section.classList.remove('hidden');
            tab.btn.classList.add('active');
            tab.loadFunc();
            toggleSidebar(false);
        });
    });
}

/**
 * Loads and displays student statistics (attendance percentage, materials count).
 * @param {string} userDocId - The student's document ID.
 * @param {string} batch - The student's batch.
 * @param {object} db - The Firestore database instance.
 */
async function loadStudentStats(userDocId, batch, db) {
    const attendanceStatEl = document.getElementById('attendance-stat');
    const materialsStatEl = document.getElementById('materials-stat');

    if (attendanceStatEl) {
        try {
            const attendanceSnapshot = await getDocs(collection(db, `users/${userDocId}/attendance`));
            const presentCount = attendanceSnapshot.docs.filter(doc => doc.data().status === 'Present').length;
            const totalDays = attendanceSnapshot.docs.length;

            if (totalDays > 0) {
                const percentage = Math.round((presentCount / totalDays) * 100);
                attendanceStatEl.textContent = `${percentage}%`;
            } else {
                attendanceStatEl.textContent = `0%`;
            }
        } catch (error) {
            console.error("Error loading attendance stats:", error);
            attendanceStatEl.textContent = '--%';
        }
    }

    if (materialsStatEl) {
        try {
            let q = query(collection(db, "materials"), where("targetBatch", "==", "Basic"));
            if (batch === 'Advanced') {
                q = query(collection(db, "materials"), where("targetBatch", "in", ["Advanced", "Basic"]));
            }
            const materialsSnapshot = await getDocs(q);
            materialsStatEl.textContent = materialsSnapshot.docs.length;
        } catch (error) {
            console.error("Error loading materials count:", error);
            materialsStatEl.textContent = '--';
        }
    }
}

/**
 * Initializes the problem tracker section, including adding, toggling, and deleting problems.
 * @param {string} userDocId - The student's document ID.
 * @param {object} db - The Firestore database instance.
 */
function initProblemTracker(userDocId, db) {
    const addProblemBtn = document.getElementById('add-problem-btn');
    const problemListEl = document.getElementById('problem-list');
    const problemLinkInput = document.getElementById('problem-link-input');
    const problemSourceSelect = document.getElementById('problem-source-select');
    const statusEl = document.getElementById('problem-tracker-status');

    if (!addProblemBtn || !problemListEl || !problemLinkInput || !problemSourceSelect || !statusEl) {
        return;
    }

    const problemsCol = collection(db, `users/${userDocId}/problems`);

    const loadProblems = () => {
        onSnapshot(problemsCol, (snapshot) => {
            problemListEl.innerHTML = '';
            if (snapshot.empty) {
                problemListEl.innerHTML = '<p class="text-gray-400 text-center">No problems tracked yet.</p>';
                return;
            }

            snapshot.forEach((doc) => {
                const problem = doc.data();
                const problemId = doc.id;

                const item = document.createElement('div');
                item.className = 'bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2';
                const isSolvedClass = problem.isSolved ? 'text-green-400' : 'text-yellow-400';
                const buttonText = problem.isSolved ? 'Mark Unsolved' : 'Mark Solved';

                item.innerHTML = `
                    <div class="flex-grow">
                        <a href="${problem.link}" target="_blank" rel="noopener noreferrer" class="font-semibold text-lg hover:underline text-blue-400">${problem.source} Problem</a>
                        <p class="text-xs text-gray-500 truncate">${problem.link}</p>
                        <p class="text-sm mt-1 ${isSolvedClass}">Status: ${problem.isSolved ? 'Solved' : 'Unsolved'}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <button data-id="${problemId}" data-solved="${problem.isSolved}" class="toggle-solved-btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded-lg text-sm transition">${buttonText}</button>
                        <button data-id="${problemId}" class="delete-problem-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm transition">Delete</button>
                    </div>
                `;
                problemListEl.appendChild(item);
            });
            setupProblemEventListeners();
        });
    };

    const setupProblemEventListeners = () => {
        problemListEl.querySelectorAll('.toggle-solved-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const problemId = e.target.dataset.id;
                const isCurrentlySolved = e.target.dataset.solved === 'true';
                try {
                    await updateDoc(doc(collection(db, `users/${userDocId}/problems`), problemId), { isSolved: !isCurrentlySolved });
                } catch (error) {
                    console.error("Failed to toggle problem status:", error);
                    showAlert('Failed to update problem status. Please try again.');
                }
            });
        });
        problemListEl.querySelectorAll('.delete-problem-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const problemId = e.target.dataset.id;
                try {
                    await deleteDoc(doc(collection(db, `users/${userDocId}/problems`), problemId));
                } catch (error) {
                    console.error("Failed to delete problem:", error);
                    showAlert('Failed to delete problem. Please try again.');
                }
            });
        });
    };
    
    addProblemBtn.addEventListener('click', async () => {
        const link = problemLinkInput.value.trim();
        if (!link) {
            statusEl.textContent = "Please enter a valid link.";
            return;
        }

        const source = problemSourceSelect.value;
        addProblemBtn.disabled = true;
        statusEl.textContent = 'Adding problem...';

        try {
            await addDoc(collection(db, `users/${userDocId}/problems`), {
                source, link, isSolved: false, addedAt: serverTimestamp()
            });
            problemLinkInput.value = '';
            statusEl.textContent = 'Problem added!';
        } catch (error) {
            console.error("Failed to add problem:", error);
            statusEl.textContent = "Failed to add problem.";
        } finally {
            addProblemBtn.disabled = false;
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });
    
    loadProblems();
}

/**
 * Loads and displays the student's attendance records.
 * @param {string} userDocId - The student's document ID.
 * @param {object} db - The Firestore database instance.
 */
function loadStudentAttendance(userDocId, db) {
    const attendanceRecordEl = document.getElementById('attendance-record');
    if (!attendanceRecordEl) return;
    const attendanceCol = collection(db, `users/${userDocId}/attendance`);
    const q = query(attendanceCol);

    // Use onSnapshot for live updates
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            attendanceRecordEl.innerHTML = '<p class="text-gray-400 text-center">No attendance records found.</p>';
            return;
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() });
        });

        // Sort in memory by date descending
        records.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
        });

        attendanceRecordEl.innerHTML = '';
        records.forEach(record => {
            const recordEl = document.createElement('div');
            recordEl.className = 'bg-gray-800 p-2 rounded text-sm mb-2';
            const statusColor = record.status === 'Present' ? 'text-green-400' : 'text-red-400';

            const durationText = record.durationInHours ? `${record.durationInHours} hour${record.durationInHours > 1 ? 's' : ''}` : 'N/A';
            const timeSlot = record.startTime && record.endTime ? `${formatTime(record.startTime)} - ${formatTime(record.endTime)}` : 'N/A';

            recordEl.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold">${formatDateDDMMYYYY(record.date)}</span>
                    <span class="font-bold ${statusColor}">${record.status}</span>
                </div>
                <div class="text-xs text-gray-400 mt-1">
                    Time Slot: ${timeSlot} | Duration: ${durationText}
                </div>
            `;
            attendanceRecordEl.appendChild(recordEl);
        });
    });
}

/**
 * Loads and displays the student's materials based on their batch.
 * @param {string} batch - The student's batch.
 * @param {object} db - The Firestore database instance.
 */
async function loadStudentMaterials(batch, db) {
    const materialsList = document.getElementById('materials-list');
    if (!materialsList) return;

    let q = query(collection(db, "materials"), where("targetBatch", "==", "Basic"));
    if (batch === 'Advanced') {
        q = query(collection(db, "materials"), where("targetBatch", "in", ["Advanced", "Basic"]));
    }
    
    const querySnapshot = await getDocs(q);
    
    materialsList.innerHTML = '';
    if (querySnapshot.empty) {
        materialsList.innerHTML = '<p class="text-gray-400 col-span-full text-center">No materials available for your batch yet.</p>';
        return;
    }

    const materials = querySnapshot.docs.map(doc => doc.data());
    materials.sort((a, b) => b.uploadedAt?.seconds - a.uploadedAt?.seconds);

    materialsList.innerHTML = materials.map(material => `
        <div class="bg-gray-800 p-4 rounded-lg flex items-center justify-between gap-4">
            <div class="flex-grow">
                <h3 class="font-bold text-lg text-blue-300">${material.name}</h3>
                <p class="text-sm text-gray-500">Uploaded: ${new Date(material.uploadedAt?.seconds * 1000).toLocaleDateString()}</p>
            </div>
            <a href="${material.url}" target="_blank" rel="noopener noreferrer" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition">Download</a>
        </div>
    `).join('');
}


// --- ADMIN DASHBOARD ---
/**
 * Sets up the tab switching functionality for the admin dashboard.
 */
function setupAdminTabs() {
    const contentTabBtn = document.getElementById('content-tab-btn');
    const attendanceTabBtn = document.getElementById('attendance-tab-btn');
    const usersTabBtn = document.getElementById('users-tab-btn');
    if (!contentTabBtn || !attendanceTabBtn || !usersTabBtn) return;

    const contentSection = document.getElementById('content-section');
    const attendanceSection = document.getElementById('attendance-section');
    const usersSection = document.getElementById('users-section');
    
    if (!contentSection || !attendanceSection || !usersSection) {
        console.warn("Missing one or more admin dashboard UI sections.");
        return;
    }

    const tabs = [
        { btn: contentTabBtn, section: contentSection },
        { btn: attendanceTabBtn, section: attendanceSection },
        { btn: usersTabBtn, section: usersSection }
    ];

    // Ensure the first tab is active on load
    contentSection.classList.remove('hidden');
    contentTabBtn.classList.add('active-tab');

    tabs.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            tabs.forEach(t => {
                t.section.classList.add('hidden');
                t.btn.classList.remove('active-tab');
            });
            tab.section.classList.remove('hidden');
            tab.btn.classList.add('active-tab');
        });
    });
}

/**
 * Initializes all the logic for the admin dashboard sections.
 * @param {object} db - The Firestore database instance.
 */
async function initAdminDashboardLogic(db) {
    initContentManagement(db);
    initAttendanceManagement(db);
    initUserManagement(db);
    initQrCodeGeneration(db);
    initSiteSettings(db);
}

// --- ADMIN: CONTENT MANAGEMENT ---
/**
 * Initializes the content management section for admins.
 * @param {object} db - The Firestore database instance.
 */
function initContentManagement(db) {
    const addMaterialForm = document.getElementById('add-material-form');
    if (!addMaterialForm) return;

    addMaterialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = document.getElementById('add-material-button');
        const statusEl = document.getElementById('add-status');
        if (!button || !statusEl) return;
        
        button.disabled = true;
        statusEl.textContent = 'Adding...';
        
        try {
            const name = document.getElementById('file-name')?.value;
            const url = document.getElementById('file-url')?.value;
            const targetBatch = document.getElementById('target-batch')?.value;
            
            if (!name || !url || !targetBatch) throw new Error("Please fill out all fields.");
            
            await addDoc(collection(db, "materials"), { name, url, targetBatch, uploadedAt: new Date() });
            statusEl.textContent = 'Material added!';
            addMaterialForm.reset();
            loadAdminMaterials(db);
        } catch (error) {
            statusEl.textContent = 'Failed to add. ' + error.message;
        } finally {
            button.disabled = false;
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });
    loadAdminMaterials(db);
}

/**
 * Loads and displays the list of all materials for admin view.
 * @param {object} db - The Firestore database instance.
 */
async function loadAdminMaterials(db) {
    const materialsList = document.getElementById('manage-materials-list');
    if (!materialsList) return;
    const q = query(collection(db, "materials"));
    const querySnapshot = await getDocs(q);

    materialsList.innerHTML = '';
    if (querySnapshot.empty) {
        materialsList.innerHTML = '<p class="text-gray-400">No materials uploaded yet.</p>';
        return;
    }
    
    const materials = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    materials.sort((a, b) => b.uploadedAt?.seconds - a.uploadedAt?.seconds);

    materialsList.innerHTML = materials.map(material => `
        <div class="bg-gray-800 p-4 rounded-lg flex items-center justify-between gap-4">
            <div class="flex-grow">
                <h3 class="font-bold text-lg text-blue-300">${material.name}</h3>
                <p class="text-sm text-gray-500">Uploaded: ${new Date(material.uploadedAt?.seconds * 1000).toLocaleDateString()}</p>
            </div>
            <a href="${material.url}" target="_blank" rel="noopener noreferrer" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition">Download</a>
        </div>
    `).join('');
}


// --- ADMIN: ATTENDANCE MANAGEMENT ---
/**
 * Initializes attendance management features for admins.
 * @param {object} db - The Firestore database instance.
 */
function initAttendanceManagement(db) {
    const attendanceForm = document.getElementById('attendance-form');
    if (!attendanceForm) return;

    const rollNoInput = document.getElementById('student-rollno');
    const dateInput = document.getElementById('attendance-date');
    const statusSelect = document.getElementById('attendance-status');
    const nameConfirmEl = document.getElementById('student-name-confirm');
    const attendanceButton = document.getElementById('mark-attendance-button');
    const deleteAttendanceButton = document.getElementById('delete-attendance-button');
    const historyDatePicker = document.getElementById('history-date-picker');
    const exportAttendanceBtn = document.getElementById('export-attendance-btn');
    const startTimeManualInput = document.getElementById('start-time-manual');
    const endTimeManualInput = document.getElementById('end-time-manual');

    const today = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = today;
    if (historyDatePicker) historyDatePicker.value = today;

    const fetchExistingAttendance = async () => {
        const rollNo = rollNoInput?.value?.trim();
        const date = dateInput?.value;
        if (nameConfirmEl) nameConfirmEl.textContent = '';
        if (nameConfirmEl) nameConfirmEl.classList.remove('text-red-400');
        if (attendanceButton) attendanceButton.textContent = 'Mark Attendance';
        if (statusSelect) statusSelect.value = 'Present';
        if (deleteAttendanceButton) deleteAttendanceButton.classList.add('hidden');
        if (startTimeManualInput) startTimeManualInput.value = '';
        if (endTimeManualInput) endTimeManualInput.value = '';

        if (!rollNo || !date) return;

        try {
            const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                if (nameConfirmEl) {
                    nameConfirmEl.textContent = 'Student not found';
                    nameConfirmEl.classList.add('text-red-400');
                }
                return;
            }

            const studentDoc = querySnapshot.docs[0];
            if (nameConfirmEl) nameConfirmEl.textContent = studentDoc.data().name;

            const attendanceRef = doc(db, `users/${studentDoc.id}/attendance`, date);
            const attendanceSnap = await getDoc(attendanceRef);

            if (attendanceSnap.exists()) {
                const data = attendanceSnap.data();
                if (statusSelect) statusSelect.value = data.status;
                if (startTimeManualInput) startTimeManualInput.value = data.startTime || '';
                if (endTimeManualInput) endTimeManualInput.value = data.endTime || '';

                if (attendanceButton) attendanceButton.textContent = 'Update Attendance';
                if (deleteAttendanceButton) deleteAttendanceButton.classList.remove('hidden');
            } else {
                if (startTimeManualInput) startTimeManualInput.value = '12:50';
                if (endTimeManualInput) endTimeManualInput.value = '15:00';
            }
        } catch (error) {
            console.error("Error fetching attendance:", error);
            if (nameConfirmEl) {
                nameConfirmEl.textContent = 'Error fetching data.';
                nameConfirmEl.classList.add('text-red-400');
            }
        }
    };
    
    if (rollNoInput) rollNoInput.addEventListener('blur', fetchExistingAttendance);
    if (dateInput) dateInput.addEventListener('change', fetchExistingAttendance);

    /**
     * Sets up a real-time listener for attendance history based on the selected date.
     * This replaces the old, inefficient method.
     */
    const setupAttendanceHistoryListener = (date) => {
        // Clear previous attendance lists
        const listA = document.getElementById('attendance-history-A');
        const listB = document.getElementById('attendance-history-B');
        const listAdvanced = document.getElementById('attendance-history-Advanced');
        
        if (listA) listA.innerHTML = '<p class="text-gray-500 p-2 text-sm text-center">Loading...</p>';
        if (listB) listB.innerHTML = '<p class="text-gray-500 p-2 text-sm text-center">Loading...</p>';
        if (listAdvanced) listAdvanced.innerHTML = '<p class="text-gray-500 p-2 text-sm text-center">Loading...</p>';

        // Fetch all students in a single query
        getDocs(query(collection(db, "users"), where("role", "==", "student"))).then(usersSnapshot => {
            const allStudents = new Map();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                allStudents.set(data.rollNo, data); // Use rollNo as key
            });

            const logsQuery = query(collection(db, "attendance_logs"), where("date", "==", date));

            // Unsubscribe from the previous listener if it exists
            if (unsubscribeFromHistory) {
                unsubscribeFromHistory();
            }
            
            // Set up the new real-time listener for logs on the selected date
            unsubscribeFromHistory = onSnapshot(logsQuery, (snapshot) => {
                const studentsWithAttendance = new Map();
                snapshot.forEach(logDoc => {
                    const logData = logDoc.data();
                    studentsWithAttendance.set(logData.rollNo, logData); // Use rollNo as key
                });
                
                const listAItems = [];
                const listBItems = [];
                const listAdvancedItems = [];

                // Process all students to determine their attendance status for the selected date
                allStudents.forEach(student => {
                    const attendance = studentsWithAttendance.get(student.rollNo);
                    // Only render students who have an explicit record for the day (Present or Absent)
                    if (attendance) {
                        const status = attendance.status;
                        const statusColor = status === 'Present' ? 'text-green-400' : 'text-red-400';
                        const rollnoText = student.rollNo ? `Roll: ${student.rollNo}` : 'Roll: N/A';
                        
                        const itemHtml = `
                            <div class="bg-gray-800 p-3 rounded-lg flex items-center justify-between gap-4 mb-2">
                                <div>
                                    <span class="font-semibold text-gray-200">${student.name}</span>
                                    <span class="text-xs text-gray-400 block mt-1">${rollnoText}</span>
                                </div>
                                <span class="font-bold ${statusColor} text-sm">${status}</span>
                            </div>
                        `;

                        if (student.batch === 'Basic' && student.division === 'A') {
                            listAItems.push({ html: itemHtml, name: student.name });
                        } else if (student.batch === 'Basic' && student.division === 'B') {
                            listBItems.push({ html: itemHtml, name: student.name });
                        } else if (student.batch === 'Advanced') {
                            listAdvancedItems.push({ html: itemHtml, name: student.name });
                        }
                    }
                });

                // Sort each list alphabetically by student name before rendering
                listAItems.sort((a, b) => a.name.localeCompare(b.name));
                listBItems.sort((a, b) => a.name.localeCompare(b.name));
                listAdvancedItems.sort((a, b) => a.name.localeCompare(b.name));
                
                const renderList = (el, items) => {
                    if (el) {
                        el.innerHTML = items.length > 0 ? items.map(item => item.html).join('') : '<p class="text-gray-500 p-2 text-sm text-center">No records for this date.</p>';
                    }
                };

                renderList(listA, listAItems);
                renderList(listB, listBItems);
                renderList(listAdvanced, listAdvancedItems);

            }); // End of onSnapshot listener
        }).catch(error => {
            console.error("Error fetching data for attendance history:", error);
            const errorMessage = '<p class="text-red-400">Failed to load attendance.</p>';
            if (listA) listA.innerHTML = errorMessage;
            if (listB) listB.innerHTML = errorMessage;
            if (listAdvanced) listAdvanced.innerHTML = errorMessage;
        }); // End of getDocs promise
    };

    if (historyDatePicker) {
        historyDatePicker.addEventListener('change', (event) => {
            setupAttendanceHistoryListener(event.target.value);
        });
        // Initial load with today's date
        setupAttendanceHistoryListener(today);
    }

    if (deleteAttendanceButton) {
        deleteAttendanceButton.addEventListener('click', async () => {
            const rollNo = rollNoInput?.value?.trim();
            const date = dateInput?.value;
            if (!rollNo || !date) {
                showAlert("Please provide a roll number and date to delete.");
                return;
            }

            const confirmed = await showConfirm(`Are you sure you want to delete the attendance record for roll no. ${rollNo} on ${date}?`);
            if (!confirmed) {
                return;
            }

            const statusEl = document.getElementById('attendance-status-msg');
            if (statusEl) statusEl.textContent = 'Deleting...';

            try {
                const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
                const userSnapshot = await getDocs(q);
                if (userSnapshot.empty) throw new Error("Student not found.");

                const studentId = userSnapshot.docs[0].id;

                await deleteDoc(doc(db, `users/${studentId}/attendance`, date));

                // Corrected query to use rollNo
                const logQuery = query(collection(db, "attendance_logs"), where("rollNo", "==", rollNo), where("date", "==", date));
                const logSnapshot = await getDocs(logQuery);
                if (!logSnapshot.empty) {
                    await deleteDoc(logSnapshot.docs[0].ref);
                }
                
                if (statusEl) statusEl.textContent = 'Record deleted successfully!';
                if (attendanceForm) attendanceForm.reset();
                if (nameConfirmEl) nameConfirmEl.textContent = '';
                if (dateInput) dateInput.value = today;
                if (deleteAttendanceButton) deleteAttendanceButton.classList.add('hidden');
                
                // Refresh attendance history after deletion
                setupAttendanceHistoryListener(historyDatePicker.value);

            } catch (error) {
                console.error("Deletion failed:", error);
                if (statusEl) statusEl.textContent = "Deletion failed.";
            } finally {
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            }
        });
    }

    if (attendanceForm) {
        attendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusEl = document.getElementById('attendance-status-msg');
            if (attendanceButton) attendanceButton.disabled = true;
            if (statusEl) statusEl.textContent = 'Saving...';
            
            try {
                const rollNo = rollNoInput?.value;
                const date = dateInput?.value;
                const newStatus = statusSelect?.value;
                const startTime = startTimeManualInput?.value;
                const endTime = endTimeManualInput?.value;
                const durationInHours = calculateDurationInHours(startTime, endTime);
                const markedAt = new Date();

                const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) throw new Error("Student not found.");

                const studentDoc = querySnapshot.docs[0];
                const studentId = studentDoc.id;
                const studentData = studentDoc.data();

                const attendanceRef = doc(db, `users/${studentId}/attendance`, date);
                await setDoc(attendanceRef, { status: newStatus, date, markedAt, startTime, endTime, durationInHours });

                // Now also update/create the record in the central attendance_logs collection
                const logQuery = query(collection(db, "attendance_logs"), where("rollNo", "==", rollNo), where("date", "==", date));
                const logSnapshot = await getDocs(logQuery);

                const logData = {
                    studentId: studentId,
                    studentName: studentData.name,
                    rollNo: studentData.rollNo,
                    moodleId: studentData.moodleId,
                    division: studentData.division,
                    batch: studentData.batch,
                    date: date,
                    status: newStatus,
                    markedAt: markedAt,
                    durationInHours: durationInHours
                };

                if (logSnapshot.empty) {
                    await addDoc(collection(db, "attendance_logs"), logData);
                } else {
                    const logDocId = logSnapshot.docs[0].id;
                    await updateDoc(doc(db, "attendance_logs", logDocId), { status: newStatus, markedAt: new Date(), durationInHours });
                }
                
                if (statusEl) statusEl.textContent = 'Attendance saved!';
                if (historyDatePicker?.value !== date) {
                    historyDatePicker.value = date;
                }
                
                // Refresh attendance history after manual save
                setupAttendanceHistoryListener(date);

            } catch (error) {
                if (statusEl) statusEl.textContent = error.message;
            } finally {
                if (attendanceButton) attendanceButton.disabled = false;
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            }
        });
    }

    if (exportAttendanceBtn) {
        exportAttendanceBtn.addEventListener('click', async () => {
            const originalText = exportAttendanceBtn.textContent;
            exportAttendanceBtn.textContent = 'Exporting...';
            exportAttendanceBtn.disabled = true;

            try {
                const usersSnapshot = await getDocs(collection(db, "users"));
                const usersMap = new Map();
                usersSnapshot.forEach(doc => {
                    usersMap.set(doc.id, doc.data());
                });

                const attendanceQuery = query(collection(db, "attendance_logs"));
                const attendanceSnapshot = await getDocs(attendanceQuery);

                if (attendanceSnapshot.empty) {
                    showAlert(`No attendance records found to export.`);
                    return;
                }

                const attendanceData = [];
                attendanceSnapshot.forEach(logDoc => {
                    const record = logDoc.data();
                    const userData = usersMap.get(record.studentId);
                    if (userData) {
                        attendanceData.push({
                            rollNo: record.rollNo,
                            name: record.studentName,
                            date: record.date,
                            status: record.status,
                            division: userData.division,
                            batch: userData.batch
                        });
                    }
                });

                attendanceData.sort((a, b) => {
                    if (a.date < b.date) return 1;
                    if (a.date > b.date) return -1;
                    return a.name.localeCompare(b.name);
                });

                const worksheet = XLSX.utils.json_to_sheet(attendanceData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, `Full Attendance History`);
                XLSX.writeFile(workbook, `full_attendance_export.xlsx`);
            } catch (error) {
                console.error("Export failed:", error);
                showAlert("Failed to export attendance.");
            } finally {
                exportAttendanceBtn.textContent = originalText;
                exportAttendanceBtn.disabled = false;
            }
        });
    }
}

// --- ADMIN: USER MANAGEMENT ---
/**
 * Initializes user management features for admins.
 * @param {object} db - The Firestore database instance.
 */
function initUserManagement(db) {
    const userListEl = document.getElementById('user-list');
    const exportBtn = document.getElementById('export-users-btn');
    const importBtn = document.getElementById('import-users-btn');
    const importFileInput = document.getElementById('import-users-input');
    const importStatusEl = document.getElementById('import-users-status');
    const createUserBtn = document.getElementById('create-user-btn');
    const createUserModal = document.getElementById('create-user-modal');
    const closeCreateUserModalBtn = document.getElementById('close-create-user-modal-btn');
    const createUserForm = document.getElementById('create-user-form');
    const createUserButton = document.getElementById('create-user-button');
    const createUserStatusEl = document.getElementById('create-user-status');
    
    if (!userListEl) return;

    if (createUserBtn && createUserModal) createUserBtn.addEventListener('click', () => createUserModal.classList.remove('hidden'));
    if (closeCreateUserModalBtn && createUserModal && createUserForm) closeCreateUserModalBtn.addEventListener('click', () => {
        createUserModal.classList.add('hidden');
        createUserForm.reset();
        if (createUserStatusEl) createUserStatusEl.textContent = '';
    });

    if (createUserForm) createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (createUserButton) createUserButton.disabled = true;
        if (createUserStatusEl) createUserStatusEl.textContent = 'Creating user...';

        const name = document.getElementById('create-name')?.value;
        const email = document.getElementById('create-email')?.value;
        const rollNo = document.getElementById('create-roll')?.value;
        const moodleId = document.getElementById('create-moodle')?.value;
        const division = document.getElementById('create-division')?.value;
        const batch = document.getElementById('create-batch')?.value;
        const password = document.getElementById('create-password')?.value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name, email, rollNo, moodleId, division, batch, role: 'student'
            });

            if (createUserStatusEl) createUserStatusEl.textContent = 'User created successfully!';
            createUserForm.reset();
            loadUsers();
            setTimeout(() => { if (createUserModal) createUserModal.classList.add('hidden'); }, 2000);
        } catch (error) {
            if (createUserStatusEl) createUserStatusEl.textContent = error.message.replace('Firebase: ', '');
            console.error("User creation failed:", error);
        } finally {
            if (createUserButton) createUserButton.disabled = false;
        }
    });

    if (exportBtn) exportBtn.addEventListener('click', async () => {
        try {
            const usersQuery = query(collection(db, "users"), where("role", "==", "student"));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                const { uid, ...rest } = data;
                return rest;
            });
            if (usersData.length === 0) {
                showAlert("No students to export.");
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(usersData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
            XLSX.writeFile(workbook, "students_export.xlsx");
        } catch (error) {
            console.error("Export failed:", error);
            showAlert("Failed to export users.");
        }
    });

    if (importBtn) importBtn.addEventListener('click', () => importFileInput.click());
    if (importFileInput) importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (importStatusEl) {
                    importStatusEl.textContent = "Processing... Please wait.";
                    importStatusEl.classList.remove('text-red-400');
                    importStatusEl.classList.add('text-green-400');
                }

                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const usersToImport = XLSX.utils.sheet_to_json(worksheet);
                if (usersToImport.length === 0) {
                    throw new Error("No data found in the spreadsheet.");
                }

                let successCount = 0;
                let updateCount = 0;
                let failCount = 0;

                for (const user of usersToImport) {
                    if (!user.moodleId || !user.email) {
                        console.warn("Skipping a row with missing Moodle ID or email:", user);
                        failCount++;
                        continue;
                    }

                    try {
                        const moodleQuery = query(collection(db, "users"), where("moodleId", "==", String(user.moodleId)));
                        const emailQuery = query(collection(db, "users"), where("email", "==", String(user.email)));

                        const moodleSnapshot = await getDocs(moodleQuery);
                        const emailSnapshot = await getDocs(emailQuery);

                        let existingUserDoc = null;
                        if (!moodleSnapshot.empty) {
                            existingUserDoc = moodleSnapshot.docs[0];
                        } else if (!emailSnapshot.empty) {
                            existingUserDoc = emailSnapshot.docs[0];
                        }

                        const userData = {
                            name: user.name,
                            rollNo: String(user.rollNo),
                            moodleId: String(user.moodleId),
                            division: user.division,
                            batch: user.batch,
                            email: user.email,
                            role: 'student'
                        };

                        if (existingUserDoc) {
                            await updateDoc(existingUserDoc.ref, userData);
                            updateCount++;
                        } else {
                            await addDoc(collection(db, "users"), {
                                ...userData,
                                uid: null
                            });
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to process user ${user.moodleId}:`, error);
                        failCount++;
                    }
                }
                if (importStatusEl) importStatusEl.textContent = `Import complete. Added: ${successCount}, Updated: ${updateCount}, Failed: ${failCount}`;
                loadUsers();
            } catch (error) {
                if (importStatusEl) {
                    importStatusEl.textContent = "Import failed. Check file format. " + error.message;
                    importStatusEl.classList.add('text-red-400');
                }
            } finally {
                importFileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    const loadUsers = async () => {
        if (userListEl) userListEl.innerHTML = '<p class="text-gray-400">Loading users...</p>';
        try {
            const usersSnapshot = await getDocs(query(collection(db, "users")));
            
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            users.sort((a, b) => a.name.localeCompare(b.name));
            
            if (userListEl) userListEl.innerHTML = '';
            
            if (users.length === 0) {
                if (userListEl) userListEl.innerHTML = '<p class="text-gray-400">No students have registered yet.</p>';
                return;
            }

            users.forEach(user => {
                if (user.role === 'admin') return;

                const userEl = document.createElement('div');
                userEl.className = 'bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4';

                const activationStatus = user.uid
                    ? `<span class="text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded-full">REGISTERED</span>`
                    : `<span class="text-xs text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-full">IMPORTED</span>`;

                userEl.innerHTML = `
                    <div class="flex-grow">
                        <div class="flex items-center gap-3">
                           <p class="font-bold text-white">${user.name}</p>
                           ${activationStatus}
                        </div>
                        <p class="text-sm text-gray-400">Roll: ${user.rollNo} | Batch: ${user.division} - ${user.batch}</p>
                        <p class="text-xs text-gray-500">Moodle ID: ${user.moodleId} | Email: ${user.email || 'N/A'}</p>
                    </div>
                    <button data-uid="${user.id}" class="delete-user-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm w-full sm:w-auto">Delete</button>
                `;
                if (userListEl) userListEl.appendChild(userEl);
            });

            document.querySelectorAll('.delete-user-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const userIdToDelete = e.target.dataset.uid;
                    const userDoc = await getDoc(doc(db, "users", userIdToDelete));
                    if (!userDoc.exists()) return;

                    const userToDelete = userDoc.data();
                    const confirmed = await showConfirm(`Are you sure you want to permanently delete ${userToDelete.name} (Roll: ${userToDelete.rollNo})? This will delete their data from the database. It CANNOT delete their login account automatically.`);
                    
                    if (confirmed) {
                        try {
                            await deleteDoc(doc(db, "users", userIdToDelete));
                            showAlert('User data deleted from database.');
                            loadUsers();
                        } catch (error) {
                            showAlert("Failed to delete user data.");
                        }
                    }
                });
            });

        } catch (error) {
            if (userListEl) userListEl.innerHTML = '<p class="text-red-400">Failed to load users.</p>';
            console.error("Error loading users:", error);
        }
    };

    loadUsers();
}

// --- ADMIN: QR CODE GENERATION & SITE SETTINGS ---
/**
 * Initializes QR code generation for attendance sessions.
 * @param {object} db - The Firestore database instance.
 */
function initQrCodeGeneration(db) {
    const startSessionBtn = document.getElementById('start-session-btn');
    if (!startSessionBtn) return;
    const startTimeAutoInput = document.getElementById('start-time-auto');
    const endTimeAutoInput = document.getElementById('end-time-auto');

    const qrModal = document.getElementById('qr-modal');
    const closeQrModalBtn = document.getElementById('close-qr-modal');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const qrTimerEl = document.getElementById('qr-timer');
    let timerInterval;

    const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    startSessionBtn.addEventListener('click', async () => {
        try {
            const startTime = startTimeAutoInput?.value;
            const endTime = endTimeAutoInput?.value;
            const durationInHours = calculateDurationInHours(startTime, endTime);
            if (durationInHours === null || durationInHours <= 0) {
                showAlert("The end time must be after the start time.");
                return;
            }

            const token = generateUUID();
            const expiry = new Date(new Date().getTime() + 5 * 60 * 1000);

            await setDoc(doc(db, "attendance_sessions", token), {
                createdAt: serverTimestamp(),
                expiresAt: expiry,
                startTime: startTime,
                endTime: endTime,
                durationInHours: durationInHours
            });

            if (qrcodeContainer) {
                qrcodeContainer.innerHTML = '';
                const qr = qrcode(0, 'L');
                qr.addData(token);
                qr.make();
                qrcodeContainer.innerHTML = qr.createImgTag(6, 8);
            }
            
            if (qrModal) qrModal.classList.remove('hidden');

            let timeLeft = 300;
            if (qrTimerEl) qrTimerEl.textContent = `Expires in: 05:00`;
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                if (qrTimerEl) qrTimerEl.textContent = `Expires in: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    if (qrTimerEl) qrTimerEl.textContent = "EXPIRED";
                }
            }, 1000);

        } catch (error) {
            console.error("QR Code generation failed:", error);
            showAlert("Could not start attendance session. Please try again.");
        }
    });

    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => {
            if (qrModal) qrModal.classList.add('hidden');
            clearInterval(timerInterval);
        });
    }
}

// --- ADMIN: SITE SETTINGS ---
/**
 * Initializes site settings for admins, particularly location-based attendance.
 * @param {object} db - The Firestore database instance.
 */
async function initSiteSettings(db) {
    const locationCheckToggleBtn = document.getElementById('toggle-location-check-btn');
    const locationCheckStatusEl = document.getElementById('setting-status-location');
    const setLocationBtn = document.getElementById('set-location-btn');
    const locationCoordsEl = document.getElementById('location-coords');
    
    if (!locationCheckToggleBtn || !locationCheckStatusEl || !setLocationBtn || !locationCoordsEl) return;

    const settingsRef = doc(db, "settings", "config");
    const locationRef = doc(db, "settings", "location");

    const handleToggle = async (statusEl, settingKey, enabledText, disabledText) => {
        const currentStatus = statusEl.textContent === enabledText;
        const update = {};
        update[settingKey] = !currentStatus;
        await setDoc(settingsRef, update, { merge: true });
        statusEl.textContent = !currentStatus ? enabledText : disabledText;
        statusEl.className = `font-bold text-lg ${!currentStatus ? 'text-green-400' : 'text-red-400'}`;
    };

    try {
        const settingsDoc = await getDoc(settingsRef);
        const isLocationCheckEnabled = settingsDoc.exists() ? settingsDoc.data().enableLocationCheck : false;
        locationCheckStatusEl.textContent = isLocationCheckEnabled ? 'ENABLED' : 'DISABLED';
        locationCheckStatusEl.className = `font-bold text-lg ${isLocationCheckEnabled ? 'text-green-400' : 'text-red-400'}`;
    } catch(e) { 
        console.error("Error loading settings", e);
        locationCheckStatusEl.textContent = 'DISABLED';
        locationCheckStatusEl.className = 'font-bold text-lg text-red-400';
    }

    locationCheckToggleBtn.addEventListener('click', () => handleToggle(locationCheckStatusEl, 'enableLocationCheck', 'ENABLED', 'DISABLED'));

    const updateLocationUI = (locationData) => {
        if (locationData && locationData.latitude) {
            locationCoordsEl.textContent = `Saved: Lat ${locationData.latitude.toFixed(4)}, Lon ${locationData.longitude.toFixed(4)}`;
        } else {
            locationCoordsEl.textContent = "No location set.";
        }
    };

    try {
        const locationDoc = await getDoc(locationRef);
        updateLocationUI(locationDoc.exists() ? locationDoc.data() : null);
    } catch (error) { console.error("Error loading location:", error); }

    setLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showAlert("Geolocation is not supported by your browser.");
            return;
        }
        setLocationBtn.disabled = true;
        setLocationBtn.textContent = "Getting Location...";
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                await setDoc(locationRef, { latitude, longitude });
                updateLocationUI({ latitude, longitude });
                showAlert("Classroom location saved successfully!");
            } catch (error) {
                showAlert("Error saving location.");
            } finally {
                setLocationBtn.disabled = false;
                setLocationBtn.textContent = "Set Current Location";
            }
        }, (error) => {
            showAlert("Could not get location. Please grant permission and ensure you have a network connection.");
            setLocationBtn.disabled = false;
            setLocationBtn.textContent = "Set Current Location";
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
}


// --- QR SCANNER LOGIC ---
function initQrScanner() {
    const readerEl = document.getElementById('reader');
    if (!readerEl) {
        console.warn("HTML element with id='reader' not found. Skipping QR scanner initialization.");
        return;
    }
    const scanStatusEl = document.getElementById('scan-status');
    const onScanSuccess = async (decodedText, decodedResult) => {
        if (html5QrCodeScanner) {
            html5QrCodeScanner.pause();
        }

        scanStatusEl.textContent = 'Processing QR code...';
        scanStatusEl.className = 'mt-4 text-center text-lg font-semibold text-yellow-400';

        try {
            const token = decodedText;
            const sessionRef = doc(db, 'attendance_sessions', token);
            const sessionSnap = await getDoc(sessionRef);

            if (!sessionSnap.exists()) {
                throw new Error("Invalid or expired QR code.");
            }

            const sessionData = sessionSnap.data();
            const currentTime = new Date().getTime();
            if (sessionData.expiresAt.toDate().getTime() < currentTime) {
                await deleteDoc(sessionRef);
                throw new Error("Attendance session has expired.");
            }

            // Check if location check is enabled
            const settingsDoc = await getDoc(doc(db, "settings", "config"));
            const enableLocationCheck = settingsDoc.exists() ? settingsDoc.data().enableLocationCheck : false;

            if (enableLocationCheck) {
                const locationDoc = await getDoc(doc(db, "settings", "location"));
                if (!locationDoc.exists() || !locationDoc.data().latitude) {
                    throw new Error("Classroom location is not set by admin. Please inform the administrator.");
                }
                const classroomLocation = locationDoc.data();

                const position = await new Promise((resolve, reject) => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
                    } else {
                        reject(new Error("Geolocation is not supported by your browser."));
                    }
                });

                const studentLat = position.coords.latitude;
                const studentLon = position.coords.longitude;
                const distance = calculateDistance(studentLat, studentLon, classroomLocation.latitude, classroomLocation.longitude);
                
                // Allow a small tolerance, e.g., 50 meters
                const tolerance = 50;
                if (distance > tolerance) {
                    throw new Error("You are not in the classroom. Please mark attendance from the correct location.");
                }
            }

            const attendanceDate = new Date().toISOString().split('T')[0];
            const attendanceRef = doc(db, `users/${currentUserProfile.id}/attendance`, attendanceDate);
            
            await setDoc(attendanceRef, {
                status: 'Present',
                date: attendanceDate,
                markedAt: new Date(),
                startTime: sessionData.startTime,
                endTime: sessionData.endTime,
                durationInHours: sessionData.durationInHours
            });

            // Update the central attendance log
            const logQuery = query(collection(db, "attendance_logs"), where("rollNo", "==", currentUserProfile.rollNo), where("date", "==", attendanceDate));
            const logSnapshot = await getDocs(logQuery);
            const logData = {
                studentId: currentUserProfile.id,
                studentName: currentUserProfile.name,
                rollNo: currentUserProfile.rollNo,
                moodleId: currentUserProfile.moodleId,
                division: currentUserProfile.division,
                batch: currentUserProfile.batch,
                date: attendanceDate,
                status: 'Present',
                markedAt: new Date(),
                durationInHours: sessionData.durationInHours
            };

            if (logSnapshot.empty) {
                await addDoc(collection(db, "attendance_logs"), logData);
            } else {
                const logDocId = logSnapshot.docs[0].id;
                await updateDoc(doc(db, "attendance_logs", logDocId), logData);
            }

            showAlert("Attendance marked successfully!", "Success");
            scanStatusEl.textContent = 'Attendance marked!';
            scanStatusEl.className = 'mt-4 text-center text-lg font-semibold text-green-400';
            playBeep();
            setTimeout(() => window.location.href = 'dashboard.html', 3000);

        } catch (error) {
            console.error("Attendance marking failed:", error);
            showAlert(error.message, "Error");
            scanStatusEl.textContent = 'Failed to mark attendance.';
            scanStatusEl.className = 'mt-4 text-center text-lg font-semibold text-red-400';
            if (html5QrCodeScanner) {
                setTimeout(() => html5QrCodeScanner.resume(), 3000);
            }
        }
    };

    const onScanFailure = (error) => {
        // Can be useful for debugging
        // console.warn(`QR code scan error: ${error}`);
    };
    
    // Start the QR scanner, but disable the 'scan file' button
    try {
        html5QrCodeScanner = new Html5QrcodeScanner("reader", { 
            fps: 15, // Increased FPS for faster scanning
            qrbox: { width: 300, height: 300 }, // Optimized QR box size
            aspectRatio: 1.777778, // Adjusted aspect ratio for a wider view
            supportedScanFormats: [Html5QrcodeSupportedFormats.QR_CODE],
            rememberLastUsedCamera: true,
            // Use an optional config object to force the camera
            // selection logic to choose the rear camera.
            videoConstraints: {
                facingMode: "environment" // Force back camera
            }
        }, false);
        html5QrCodeScanner.render(onScanSuccess, onScanFailure);
    } catch(error) {
        console.error("Failed to start QR scanner:", error);
        scanStatusEl.textContent = "Error: Failed to start camera. Check your permissions.";
        scanStatusEl.className = 'mt-4 text-center text-lg font-semibold text-red-400';
    }
}
