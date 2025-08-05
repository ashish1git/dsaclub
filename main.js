// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
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
    orderBy,
    updateDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// The Html5Qrcode library is loaded via a <script> tag in scanner.html.
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

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("!!! FATAL ERROR: Could not initialize Firebase. Check your firebaseConfig object. !!!", e);
    document.body.innerHTML = '<div style="color: red; font-size: 24px; text-align: center; padding: 50px;">Error: Could not connect to the server. Please check your Firebase configuration.</div>';
}

// --- HELPER FUNCTION ---
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

// --- MAIN INITIALIZATION LOGIC ---
window.addEventListener('load', () => {
    setupMatrixAnimation();
    setupAdminTabs();
    
    onAuthStateChanged(auth, async (user) => {
        const currentPage = window.location.pathname.split("/").pop();
        if (user) {
            const userProfile = await getUserProfile(user.uid);
            
            if (userProfile && userProfile.role === 'admin') {
                if (currentPage !== 'admin.html') { window.location.href = 'admin.html'; return; }
            } else if (userProfile) {
                if (currentPage !== 'dashboard.html' && currentPage !== 'scanner.html') { window.location.href = 'dashboard.html'; return; }
            } else {
                console.error("Logged in user has no profile. Logging out.");
                await signOut(auth);
                return;
            }

            if (userProfile) {
                if (currentPage === 'dashboard.html') initStudentDashboard(userProfile, db);
                else if (currentPage === 'admin.html') initAdminDashboardLogic(db);
                else if (currentPage === 'scanner.html') initQrScanner(userProfile.id, db);
            }
        } else {
            const protectedPages = ['dashboard.html', 'admin.html', 'scanner.html'];
            if (protectedPages.includes(currentPage)) window.location.href = 'index.html';
        }
    });
    setupAuthForms();
});

// --- UI & ANIMATION ---
function setupMatrixAnimation() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    function setupCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        const keywords = ['Array', 'LinkedList', 'Stack', 'Queue', 'Tree', 'Graph', 'Sort()', 'Search()', 'BigO', 'for', 'while', 'if', 'else', 'class', 'public', 'static', 'void', 'main', 'return', 'new', 'C++', 'Java', 'Python', 'JS', '{}', '()', '[]', ';', '=>', 'async', 'await', 'Node', 'React', 'HTML', 'CSS'];
        const colors = ['#569cd6', '#4ec9b0', '#c586c0', '#dcdcaa', '#9cdcfe', '#ce9178'];
        const particleCount = Math.floor((canvas.width * canvas.height) / 25000);
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
                text: keywords[Math.floor(Math.random() * keywords.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 2 * Math.PI, rotationSpeed: (Math.random() - 0.5) * 0.005
            });
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animate();
    }
    function animate() {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.rotation += p.rotationSpeed;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
            ctx.font = `bold 16px Fira Code`; ctx.fillStyle = p.color;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text, 0, 0); ctx.restore();
        });
        animationFrameId = requestAnimationFrame(animate);
    }
    window.addEventListener('resize', setupCanvas);
    setupCanvas();
}

// --- AUTHENTICATION ---
function setupAuthForms() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            button.classList.add('btn-loading');
            button.disabled = true;

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const rollNo = document.getElementById('signup-roll').value;
            const moodleId = document.getElementById('signup-moodle').value;
            const division = document.getElementById('signup-division').value;
            const batch = document.getElementById('signup-batch').value;
            const password = document.getElementById('signup-password').value;
            const errorEl = document.getElementById('signup-error');
            errorEl.textContent = '';

            try {
                // Check if Moodle ID or email already exists to prevent duplicates
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

                // Create Firebase Auth user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Create user document in Firestore with the UID as the document ID
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name,
                    email,
                    rollNo,
                    moodleId,
                    division,
                    batch,
                    role: 'student'
                });
                // onAuthStateChanged will handle the redirect
            } catch (error) {
                errorEl.textContent = error.message.replace('Firebase: ', '');
                button.classList.remove('btn-loading');
                button.disabled = false;
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            button.classList.add('btn-loading');
            button.disabled = true;

            const identifier = document.getElementById('login-identifier').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.textContent = '';

            try {
                if (identifier.includes('@')) {
                    // --- ADMIN LOGIN PATH ---
                    await signInWithEmailAndPassword(auth, identifier, password);
                } else {
                    // --- STUDENT LOGIN PATH ---
                    const moodleId = identifier;
                    const q = query(collection(db, "users"), where("moodleId", "==", moodleId));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        throw new Error("Moodle ID not found.");
                    }
                    
                    const studentData = querySnapshot.docs[0].data();
                    if (!studentData.email) {
                        throw new Error("Account data is incomplete. Please ask the student to register.");
                    }

                    await signInWithEmailAndPassword(auth, studentData.email, password);
                }
            } catch (error) {
                console.error("Login Error:", error);
                errorEl.textContent = "Invalid credential or password.";
                button.classList.remove('btn-loading');
                button.disabled = false;
            }
        });
    }
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) logoutButton.addEventListener('click', async () => await signOut(auth));
}


// --- STUDENT DASHBOARD ---
async function initStudentDashboard(userData, db) {
    if (!userData) return;
    const welcomeMessage = document.getElementById('welcome-message');
    welcomeMessage.innerHTML = `<h1 class="text-2xl sm:text-3xl md:text-4xl font-bold font-code text-blue-400">Welcome, ${userData.name}!</h1><p class="text-gray-400 mt-2 text-sm sm:text-base">Your Batch: <span class="font-bold text-green-400">${userData.division} - ${userData.batch}</span> | Lab: <span class="font-bold text-green-400">${userData.batch === 'Advanced' ? '407' : (userData.division === 'A' ? '406' : '405')}</span></p>`;
    
    loadStudentAttendance(userData.id, db);
    loadStudentMaterials(userData.batch, db);
    setupPasswordChangeForm();
}

function setupPasswordChangeForm() {
    const passwordForm = document.getElementById('change-password-form');
    if (!passwordForm) return;

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const button = document.getElementById('change-password-button');
        const statusEl = document.getElementById('change-password-status');

        if (newPassword.length < 6) {
            statusEl.textContent = "Password must be at least 6 characters.";
            statusEl.className = 'text-red-400 text-center h-4 mt-4';
            return;
        }

        button.disabled = true;
        statusEl.textContent = "Changing...";
        statusEl.className = 'text-yellow-400 text-center h-4 mt-4';

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not logged in.");
            
            await updatePassword(user, newPassword);
            
            statusEl.textContent = "Password changed successfully!";
            statusEl.className = 'text-green-400 text-center h-4 mt-4';
            passwordForm.reset();
        } catch (error) {
            console.error("Password change failed:", error);
            statusEl.textContent = "Failed to change password.";
            statusEl.className = 'text-red-400 text-center h-4 mt-4';
        } finally {
            button.disabled = false;
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        }
    });
}

// --- ADMIN DASHBOARD ---
function setupAdminTabs() {
    const contentTabBtn = document.getElementById('content-tab-btn');
    const attendanceTabBtn = document.getElementById('attendance-tab-btn');
    const usersTabBtn = document.getElementById('users-tab-btn');
    if (!contentTabBtn || !attendanceTabBtn || !usersTabBtn) return;

    const contentSection = document.getElementById('content-section');
    const attendanceSection = document.getElementById('attendance-section');
    const usersSection = document.getElementById('users-section');

    const tabs = [
        { btn: contentTabBtn, section: contentSection },
        { btn: attendanceTabBtn, section: attendanceSection },
        { btn: usersTabBtn, section: usersSection }
    ];

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

async function initAdminDashboardLogic(db) {
    initContentManagement(db);
    initAttendanceManagement(db);
    initUserManagement(db);
    initQrCodeGeneration(db);
    initSiteSettings(db);
}

// --- ADMIN: CONTENT MANAGEMENT ---
function initContentManagement(db) {
    const addMaterialForm = document.getElementById('add-material-form');
    if (!addMaterialForm) return;

    addMaterialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = document.getElementById('add-material-button');
        const statusEl = document.getElementById('add-status');
        button.disabled = true;
        statusEl.textContent = 'Adding...';
        try {
            const name = document.getElementById('file-name').value;
            const url = document.getElementById('file-url').value;
            const targetBatch = document.getElementById('target-batch').value;
            await addDoc(collection(db, "materials"), { name, url, targetBatch, uploadedAt: new Date() });
            statusEl.textContent = 'Material added!';
            addMaterialForm.reset();
            loadAdminMaterials(db);
        } catch (error) {
            statusEl.textContent = 'Failed to add.';
        } finally {
            button.disabled = false;
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });
    loadAdminMaterials(db);
}

// --- ADMIN: ATTENDANCE MANAGEMENT ---
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
    
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    if (historyDatePicker) historyDatePicker.value = today;
    
    let unsubscribeFromHistory; 

    const fetchExistingAttendance = async () => {
        const rollNo = rollNoInput.value.trim();
        const date = dateInput.value;
        nameConfirmEl.textContent = '';
        nameConfirmEl.classList.remove('text-red-400');
        attendanceButton.textContent = 'Mark Attendance';
        statusSelect.value = 'Present';
        deleteAttendanceButton.classList.add('hidden');

        if (!rollNo) return;

        try {
            const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                nameConfirmEl.textContent = 'Student not found';
                nameConfirmEl.classList.add('text-red-400');
                return;
            }
            
            const studentDoc = querySnapshot.docs[0];
            nameConfirmEl.textContent = studentDoc.data().name;

            if (!date) return;

            const attendanceRef = doc(db, `users/${studentDoc.id}/attendance`, date);
            const attendanceSnap = await getDoc(attendanceRef);

            if (attendanceSnap.exists()) {
                statusSelect.value = attendanceSnap.data().status;
                attendanceButton.textContent = 'Update Attendance';
                deleteAttendanceButton.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Error fetching attendance:", error);
            nameConfirmEl.textContent = 'Error fetching data.';
            nameConfirmEl.classList.add('text-red-400');
        }
    };

    rollNoInput.addEventListener('blur', fetchExistingAttendance);
    dateInput.addEventListener('change', fetchExistingAttendance);
    if(historyDatePicker) {
        historyDatePicker.addEventListener('change', () => {
            if (unsubscribeFromHistory) unsubscribeFromHistory();
            unsubscribeFromHistory = loadSegregatedAttendanceHistory(db, historyDatePicker.value);
        });
    }

    deleteAttendanceButton.addEventListener('click', async () => {
        const rollNo = rollNoInput.value.trim();
        const date = dateInput.value;
        if (!rollNo || !date) {
            alert("Please provide a roll number and date to delete.");
            return;
        }

        if (!confirm(`Are you sure you want to delete the attendance record for roll no. ${rollNo} on ${date}?`)) {
            return;
        }

        const statusEl = document.getElementById('attendance-status-msg');
        statusEl.textContent = 'Deleting...';

        try {
            const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
            const userSnapshot = await getDocs(q);
            if (userSnapshot.empty) throw new Error("Student not found.");

            const studentId = userSnapshot.docs[0].id;

            await deleteDoc(doc(db, `users/${studentId}/attendance`, date));

            const logQuery = query(collection(db, "attendance_logs"), where("studentId", "==", studentId), where("date", "==", date));
            const logSnapshot = await getDocs(logQuery);
            if (!logSnapshot.empty) {
                await deleteDoc(logSnapshot.docs[0].ref);
            }

            statusEl.textContent = 'Record deleted successfully!';
            attendanceForm.reset();
            nameConfirmEl.textContent = '';
            dateInput.value = today;
            deleteAttendanceButton.classList.add('hidden');

        } catch (error) {
            console.error("Deletion failed:", error);
            statusEl.textContent = "Deletion failed.";
        } finally {
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });

    attendanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('attendance-status-msg');
        attendanceButton.disabled = true;
        statusEl.textContent = 'Saving...';
        try {
            const rollNo = rollNoInput.value;
            const date = dateInput.value;
            const newStatus = statusSelect.value;

            const q = query(collection(db, "users"), where("rollNo", "==", rollNo));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) throw new Error("Student not found.");
            
            const studentDoc = querySnapshot.docs[0];
            const studentId = studentDoc.id;
            const studentData = studentDoc.data();
            
            const attendanceRef = doc(db, `users/${studentId}/attendance`, date);
            await setDoc(attendanceRef, { status: newStatus, date });

            const logQuery = query(collection(db, "attendance_logs"), where("studentId", "==", studentId), where("date", "==", date));
            const logSnapshot = await getDocs(logQuery);

            const logData = {
                studentId: studentId,
                studentName: studentData.name,
                rollNo: studentData.rollNo,
                date: date,
                status: newStatus,
                markedAt: new Date()
            };

            if (logSnapshot.empty) {
                await addDoc(collection(db, "attendance_logs"), logData);
            } else {
                const logDocId = logSnapshot.docs[0].id;
                await updateDoc(doc(db, "attendance_logs", logDocId), { status: newStatus, markedAt: new Date() });
            }
            
            statusEl.textContent = 'Attendance saved!';
            if (historyDatePicker.value !== date) {
                historyDatePicker.value = date;
                if (unsubscribeFromHistory) unsubscribeFromHistory();
                unsubscribeFromHistory = loadSegregatedAttendanceHistory(db, date);
            }
        } catch (error) {
            statusEl.textContent = error.message;
        } finally {
            attendanceButton.disabled = false;
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });

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

            const attendanceQuery = query(collection(db, "attendance_logs"), orderBy("date", "desc"));
            const attendanceSnapshot = await getDocs(attendanceQuery);

            if (attendanceSnapshot.empty) {
                alert(`No attendance records found to export.`);
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
            alert("Failed to export attendance.");
        } finally {
            exportAttendanceBtn.textContent = originalText;
            exportAttendanceBtn.disabled = false;
        }
    });
    
    unsubscribeFromHistory = loadSegregatedAttendanceHistory(db, today);
}

// --- ADMIN: USER MANAGEMENT (REBUILT IMPORT) ---
function initUserManagement(db) {
    const userListEl = document.getElementById('user-list');
    const exportBtn = document.getElementById('export-users-btn');
    const importBtn = document.getElementById('import-users-btn');
    const importFileInput = document.getElementById('import-users-input');
    const importStatusEl = document.getElementById('import-users-status');
    if (!userListEl) return;

    exportBtn.addEventListener('click', async () => {
        try {
            const usersQuery = query(collection(db, "users"), where("role", "==", "student"));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                const { uid, ...rest } = data; // Exclude uid from export
                return rest;
            });

            const worksheet = XLSX.utils.json_to_sheet(usersData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
            XLSX.writeFile(workbook, "students_export.xlsx");
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export users.");
        }
    });

    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                importStatusEl.textContent = "Processing... Please wait.";
                importStatusEl.classList.remove('text-red-400');
                importStatusEl.classList.add('text-green-400');

                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const usersToImport = XLSX.utils.sheet_to_json(worksheet);

                let successCount = 0;
                let updateCount = 0;
                let failCount = 0;

                for (const user of usersToImport) {
                    try {
                        // Find user by Moodle ID OR Email to handle both cases
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
                            // --- UPDATE PATH ---
                            await updateDoc(existingUserDoc.ref, userData);
                            updateCount++;
                        } else {
                            // --- CREATE PATH (Profile only, no Auth) ---
                            await addDoc(collection(db, "users"), {
                                ...userData,
                                uid: null // UID will be set when the user registers
                            });
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to process user ${user.moodleId}:`, error);
                        failCount++;
                    }
                }
                importStatusEl.textContent = `Import complete. Added: ${successCount}, Updated: ${updateCount}, Failed: ${failCount}`;
                loadUsers();
            } catch (error) {
                importStatusEl.textContent = "Import failed. Check file format.";
                importStatusEl.classList.add('text-red-400');
            } finally {
                importFileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    const loadUsers = async () => {
        userListEl.innerHTML = '<p class="text-gray-400">Loading users...</p>';
        try {
            const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("name")));
            if (usersSnapshot.empty) {
                userListEl.innerHTML = '<p class="text-gray-400">No students have registered yet.</p>';
                return;
            }

            userListEl.innerHTML = '';
            usersSnapshot.forEach(doc => {
                const user = doc.data();
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
                    <button data-uid="${doc.id}" class="delete-user-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm w-full sm:w-auto">Delete</button>
                `;
                userListEl.appendChild(userEl);
            });

            document.querySelectorAll('.delete-user-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const userIdToDelete = e.target.dataset.uid;
                    const userDoc = await getDoc(doc(db, "users", userIdToDelete));
                    if (!userDoc.exists()) return;
                    
                    const userToDelete = userDoc.data();
                    
                    if (confirm(`Are you sure you want to permanently delete ${userToDelete.name} (Roll: ${userToDelete.rollNo})? This will delete their data from the database. It CANNOT delete their login account automatically.`)) {
                        try {
                            await deleteDoc(doc(db, "users", userIdToDelete));
                            alert('User data deleted from database.');
                            loadUsers();
                        } catch (error) {
                            alert("Failed to delete user data.");
                        }
                    }
                });
            });

        } catch (error) {
            userListEl.innerHTML = '<p class="text-red-400">Failed to load users.</p>';
        }
    };

    loadUsers();
}

// --- ADMIN: QR CODE GENERATION & SITE SETTINGS ---
function initQrCodeGeneration(db) {
    const startSessionBtn = document.getElementById('start-session-btn');
    if (!startSessionBtn) return;

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
            const token = generateUUID();
            const expiry = new Date(new Date().getTime() + 5 * 60 * 1000);

            await setDoc(doc(db, "attendance_sessions", token), {
                createdAt: serverTimestamp(),
                expiresAt: expiry
            });

            qrcodeContainer.innerHTML = '';
            const qr = qrcode(0, 'L');
            qr.addData(token);
            qr.make();
            qrcodeContainer.innerHTML = qr.createImgTag(6, 8);
            
            qrModal.classList.remove('hidden');

            let timeLeft = 300;
            qrTimerEl.textContent = `Expires in: 05:00`;
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                qrTimerEl.textContent = `Expires in: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    qrTimerEl.textContent = "EXPIRED";
                }
            }, 1000);

        } catch (error) {
            alert("Could not start attendance session. Please try again.");
        }
    });

    closeQrModalBtn.addEventListener('click', () => {
        qrModal.classList.add('hidden');
        clearInterval(timerInterval);
    });
}

async function initSiteSettings(db) {
    const locationCheckToggleBtn = document.getElementById('toggle-location-check-btn');
    const locationCheckStatusEl = document.getElementById('setting-status-location');
    const setLocationBtn = document.getElementById('set-location-btn');
    const locationCoordsEl = document.getElementById('location-coords');
    
    if (!locationCheckToggleBtn) return;

    const settingsRef = doc(db, "settings", "config");
    const locationRef = doc(db, "settings", "location");

    const handleToggle = async (button, statusEl, settingKey, enabledText, disabledText) => {
        const currentStatus = statusEl.textContent === enabledText;
        const update = {};
        update[settingKey] = !currentStatus;
        await setDoc(settingsRef, update, { merge: true });
        statusEl.textContent = !currentStatus ? enabledText : disabledText;
        statusEl.className = `font-bold text-lg ${!currentStatus ? 'text-green-400' : 'text-red-400'}`;
    };

    try {
        const settingsDoc = await getDoc(settingsRef);
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            const isLocationCheckEnabled = settings.enableLocationCheck;
            locationCheckStatusEl.textContent = isLocationCheckEnabled ? 'ENABLED' : 'DISABLED';
            locationCheckStatusEl.className = `font-bold text-lg ${isLocationCheckEnabled ? 'text-green-400' : 'text-red-400'}`;
        } else {
             locationCheckStatusEl.textContent = 'DISABLED';
             locationCheckStatusEl.className = 'font-bold text-lg text-red-400';
        }
    } catch(e) { console.error("Error loading settings", e)}

    locationCheckToggleBtn.addEventListener('click', () => handleToggle(locationCheckToggleBtn, locationCheckStatusEl, 'enableLocationCheck', 'ENABLED', 'DISABLED'));

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
            alert("Geolocation is not supported by your browser.");
            return;
        }
        setLocationBtn.disabled = true;
        setLocationBtn.textContent = "Getting Location...";
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                await setDoc(locationRef, { latitude, longitude });
                updateLocationUI({ latitude, longitude });
                alert("Classroom location saved successfully!");
            } catch (error) {
                alert("Error saving location.");
            } finally {
                setLocationBtn.disabled = false;
                setLocationBtn.textContent = "Set Current Location";
            }
        }, (error) => {
            alert("Could not get location. Please grant permission and ensure you have a network connection.");
            setLocationBtn.disabled = false;
            setLocationBtn.textContent = "Set Current Location";
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
}

// --- STUDENT: QR CODE SCANNER ---
function initQrScanner(userDocId, db) {
    const scanStatusEl = document.getElementById('scan-status');
    if (!scanStatusEl) return;

    const html5QrCode = new Html5Qrcode("qr-reader");

    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
        html5QrCode.stop().catch(err => console.error("Failed to stop QR scanner:", err));
        
        scanStatusEl.textContent = "Verifying...";
        scanStatusEl.className = 'mt-4 h-8 text-lg font-semibold text-yellow-400';

        try {
            const settingsRef = doc(db, "settings", "config");
            const settingsDoc = await getDoc(settingsRef);
            const locationCheckEnabled = settingsDoc.exists() && settingsDoc.data().enableLocationCheck === true;

            if (locationCheckEnabled) {
                scanStatusEl.textContent = "Getting your location...";
                const studentPosition = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) reject(new Error("Geolocation not supported."));
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                });
                
                const { latitude: studentLat, longitude: studentLon } = studentPosition.coords;

                const locationRef = doc(db, "settings", "location");
                const locationDoc = await getDoc(locationRef);
                if (!locationDoc.exists()) throw new Error("Classroom location not set by admin.");
                
                const { latitude: classLat, longitude: classLon } = locationDoc.data();

                const distance = calculateDistance(studentLat, studentLon, classLat, classLon);
                const ALLOWED_RADIUS_METERS = 100;
                
                if (distance > ALLOWED_RADIUS_METERS) {
                    throw new Error(`You are too far from the classroom (${Math.round(distance)}m away).`);
                }
            }

            scanStatusEl.textContent = "Verifying QR code...";
            const token = decodedText;
            const today = new Date().toISOString().split('T')[0];

            const existingAttendanceRef = doc(db, `users/${userDocId}/attendance`, today);
            const existingAttendanceSnap = await getDoc(existingAttendanceRef);
            if (existingAttendanceSnap.exists()) {
                throw new Error("Attendance already marked for today.");
            }

            const sessionRef = doc(db, "attendance_sessions", token);
            const sessionSnap = await getDoc(sessionRef);

            if (!sessionSnap.exists() || new Date() > sessionSnap.data().expiresAt.toDate()) {
                throw new Error("Invalid or expired QR code.");
            }

            const userDoc = await getDoc(doc(db, "users", userDocId));
            if (!userDoc.exists()) throw new Error("User profile not found.");
            
            const { name, rollNo } = userDoc.data();
            
            await setDoc(doc(db, `users/${userDocId}/attendance`, today), { status: "Present", date: today });

            await addDoc(collection(db, "attendance_logs"), {
                studentId: userDocId, studentName: name, rollNo, date: today, status: "Present", markedAt: new Date()
            });
            
            scanStatusEl.textContent = "Success! Attendance marked.";
            scanStatusEl.className = 'mt-4 h-8 text-lg font-semibold text-green-400';
            playBeep();

        } catch (error) {
            scanStatusEl.textContent = error.message;
            scanStatusEl.className = 'mt-4 h-8 text-lg font-semibold text-red-400';
        }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            scanStatusEl.textContent = "Could not start camera. Please allow permission.";
            scanStatusEl.className = 'mt-4 h-8 text-lg font-semibold text-red-400';
        });
}

// --- HELPER / UTILITY FUNCTIONS ---
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

function formatDateDDMMYYYY(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

function loadSegregatedAttendanceHistory(db, date) {
    const historyContainerA = document.getElementById('attendance-history-A');
    const historyContainerB = document.getElementById('attendance-history-B');
    const historyContainerAdvanced = document.getElementById('attendance-history-Advanced');

    const containers = [historyContainerA, historyContainerB, historyContainerAdvanced];
    containers.forEach(c => {
        if(c) c.innerHTML = '<p class="text-gray-500 text-sm text-center">Loading records...</p>';
    });

    const q = query(collection(db, "attendance_logs"), where("date", "==", date));
    
    return onSnapshot(q, async (snapshot) => {
        containers.forEach(c => {
            if(c) c.innerHTML = '<p class="text-gray-500 text-sm text-center">No records for this date.</p>';
        });

        if (snapshot.empty) return;
        
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersMap = new Map();
        usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, doc.data());
        });

        let recordsA = [], recordsB = [], recordsAdvanced = [];

        snapshot.forEach(logDoc => {
            const record = logDoc.data();
            const userData = usersMap.get(record.studentId);
            if (userData) {
                const recordWithUserData = { ...record, ...userData };
                if (userData.batch === 'Advanced') recordsAdvanced.push(recordWithUserData);
                else if (userData.division === 'A') recordsA.push(recordWithUserData);
                else if (userData.division === 'B') recordsB.push(recordWithUserData);
            }
        });

        const sortByName = (a, b) => a.name.localeCompare(b.name);
        recordsA.sort(sortByName);
        recordsB.sort(sortByName);
        recordsAdvanced.sort(sortByName);

        const renderList = (container, records) => {
            if (records.length === 0) return;
            container.innerHTML = '';
            records.forEach((record, index) => {
                const recordEl = document.createElement('div');
                recordEl.className = 'bg-gray-800 p-2 rounded text-sm mb-2';
                const statusColor = record.status === 'Present' ? 'text-green-400' : 'text-red-400';
                recordEl.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-bold">${index + 1}. ${record.studentName}</span>
                        <span class="font-bold ${statusColor}">${record.status}</span>
                    </div>
                    <div class="text-xs text-gray-400">Roll: ${record.rollNo}</div>
                `;
                container.appendChild(recordEl);
            });
        };

        renderList(historyContainerA, recordsA);
        renderList(historyContainerB, recordsB);
        renderList(historyContainerAdvanced, recordsAdvanced);
    });
}

async function loadStudentAttendance(userDocId, db) {
    const attendanceRecordEl = document.getElementById('attendance-record');
    if (!attendanceRecordEl) return;
    const attendanceCol = collection(db, `users/${userDocId}/attendance`);
    const q = query(attendanceCol, orderBy("date", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        attendanceRecordEl.innerHTML = '<p class="text-gray-400 text-center">No attendance records found.</p>';
        return;
    }

    attendanceRecordEl.innerHTML = '';
    snapshot.forEach(doc => {
        const record = doc.data();
        const recordEl = document.createElement('div');
        recordEl.className = 'flex justify-between items-center bg-gray-800 p-2 rounded';
        const statusColor = record.status === 'Present' ? 'text-green-400' : 'text-red-400';
        recordEl.innerHTML = `<span>${formatDateDDMMYYYY(record.date)}</span><span class="font-bold ${statusColor}">${record.status}</span>`;
        attendanceRecordEl.appendChild(recordEl);
    });
}

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
    materials.sort((a, b) => b.uploadedAt.seconds - a.uploadedAt.seconds);

    materialsList.innerHTML = materials.map(material => `
        <div class="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex-grow">
                <h3 class="font-bold text-lg text-blue-300">${material.name}</h3>
                <p class="text-sm text-gray-500">Uploaded: ${new Date(material.uploadedAt.seconds * 1000).toLocaleDateString()}</p>
            </div>
            <a href="${material.url}" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition">Download</a>
        </div>
    `).join('');
}

async function loadAdminMaterials(db) {
    const materialsList = document.getElementById('manage-materials-list');
    if (!materialsList) return;
    const q = query(collection(db, "materials"), orderBy("uploadedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    materialsList.innerHTML = '';
    if (querySnapshot.empty) {
        materialsList.innerHTML = '<p class="text-gray-400">No materials uploaded yet.</p>';
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const material = docSnap.data();
        const materialEl = document.createElement('div');
        materialEl.className = 'bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3';
        materialEl.innerHTML = `
            <div class="flex-grow">
                <h4 class="font-semibold text-gray-200">${material.name}</h4>
                <span class="text-xs text-blue-400 bg-gray-700 px-2 py-1 rounded-full">${material.targetBatch} Batch</span>
            </div>
            <button data-id="${docSnap.id}" class="delete-btn w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm">Delete</button>
        `;
        materialsList.appendChild(materialEl);
    });

    materialsList.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const docId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this material record?')) {
                try {
                    await deleteDoc(doc(db, "materials", docId));
                    await loadAdminMaterials(db);
                } catch (error) {
                    alert("Could not delete material record.");
                }
            }
        });
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}
