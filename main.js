// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
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
    limit,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your specific Firebase configuration is now included.
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

// --- MAIN INITIALIZATION LOGIC ---
window.addEventListener('load', () => {
    setupMatrixAnimation();
    setupAdminTabs(); // Set up UI listeners once the page loads.
    
    onAuthStateChanged(auth, async (user) => {
        const currentPage = window.location.pathname.split("/").pop();
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                if (currentPage !== 'admin.html') { window.location.href = 'admin.html'; return; }
            } else {
                if (currentPage !== 'dashboard.html') { window.location.href = 'dashboard.html'; return; }
            }
            if (currentPage === 'dashboard.html') initStudentDashboard(user.uid, db);
            else if (currentPage === 'admin.html') initAdminDashboardLogic(db);
        } else {
            const protectedPages = ['dashboard.html', 'admin.html'];
            if (protectedPages.includes(currentPage)) window.location.href = 'index.html';
        }
    });
    setupAuthForms();
});

// --- FUNCTION DEFINITIONS ---
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

function setupAuthForms() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = e.target.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.classList.add('btn-loading');
            button.disabled = true;

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const rollNo = document.getElementById('signup-roll').value;
            const moodleId = document.getElementById('signup-moodle').value;
            const division = document.getElementById('signup-division').value;
            const batch = document.getElementById('signup-batch').value;
            const errorEl = document.getElementById('signup-error');
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                await setDoc(doc(db, "users", user.uid), { name, email, rollNo, moodleId, division, batch, role: 'student' });
            } catch (error) {
                errorEl.textContent = error.message.replace('Firebase: ', '');
                button.textContent = originalText;
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
            const originalText = button.textContent;
            button.classList.add('btn-loading');
            button.disabled = true;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                errorEl.textContent = "Invalid email or password.";
                button.textContent = originalText;
                button.classList.remove('btn-loading');
                button.disabled = false;
            }
        });
    }
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) logoutButton.addEventListener('click', async () => await signOut(auth));
}

async function initStudentDashboard(uid, db) {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (!userDoc.exists()) return;
    const userData = userDoc.data();
    const welcomeMessage = document.getElementById('welcome-message');
    welcomeMessage.innerHTML = `<h1 class="text-2xl sm:text-3xl md:text-4xl font-bold font-code text-blue-400">Welcome, ${userData.name}!</h1><p class="text-gray-400 mt-2 text-sm sm:text-base">Your Batch: <span class="font-bold text-green-400">${userData.division} - ${userData.batch}</span> | Lab: <span class="font-bold text-green-400">${userData.batch === 'Advanced' ? '407' : (userData.division === 'A' ? '406' : '405')}</span></p>`;
    
    loadStudentAttendance(uid, db);
    loadStudentMaterials(userData.batch, db);
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
    const historyDatePicker = document.getElementById('history-date-picker');

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    if (historyDatePicker) historyDatePicker.value = today;

    const fetchExistingAttendance = async () => {
        const rollNo = rollNoInput.value.trim();
        const date = dateInput.value;
        nameConfirmEl.textContent = '';
        nameConfirmEl.classList.remove('text-red-400');
        attendanceButton.textContent = 'Mark Attendance';
        statusSelect.value = 'Present';

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
            loadSegregatedAttendanceHistory(db, historyDatePicker.value);
        });
    }

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
            const studentName = studentDoc.data().name;
            
            const attendanceRef = doc(db, `users/${studentId}/attendance`, date);
            await setDoc(attendanceRef, { status: newStatus, date });

            const logQuery = query(collection(db, "attendance_logs"), where("studentId", "==", studentId), where("date", "==", date));
            const logSnapshot = await getDocs(logQuery);

            if (logSnapshot.empty) {
                await addDoc(collection(db, "attendance_logs"), {
                    studentId, studentName, rollNo, date, status: newStatus, markedAt: new Date()
                });
            } else {
                const logDocId = logSnapshot.docs[0].id;
                await updateDoc(doc(db, "attendance_logs", logDocId), { status: newStatus, markedAt: new Date() });
            }
            
            statusEl.textContent = 'Attendance saved!';
            if (historyDatePicker) historyDatePicker.value = date;
            loadSegregatedAttendanceHistory(db, date);
        } catch (error) {
            statusEl.textContent = error.message;
        } finally {
            attendanceButton.disabled = false;
            setTimeout(() => statusEl.textContent = '', 3000);
        }
    });

    loadSegregatedAttendanceHistory(db, today);
}

// --- ADMIN: USER MANAGEMENT ---
function initUserManagement(db) {
    const userListEl = document.getElementById('user-list');
    if (!userListEl) return;

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
                if (user.role === 'admin') return; // Don't show admin in the list

                const userEl = document.createElement('div');
                userEl.className = 'bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4';
                userEl.innerHTML = `
                    <div class="flex-grow">
                        <p class="font-bold text-white">${user.name}</p>
                        <p class="text-sm text-gray-400">Roll: ${user.rollNo} | Batch: ${user.division} - ${user.batch}</p>
                        <p class="text-xs text-gray-500">${user.email}</p>
                    </div>
                    <button data-uid="${doc.id}" class="delete-user-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm w-full sm:w-auto">Delete</button>
                `;
                userListEl.appendChild(userEl);
            });

            // Add event listeners to the new delete buttons
            document.querySelectorAll('.delete-user-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const userIdToDelete = e.target.dataset.uid;
                    const userDoc = await getDoc(doc(db, "users", userIdToDelete));
                    if (!userDoc.exists()) return;
                    
                    const userToDelete = userDoc.data();
                    
                    if (confirm(`Are you sure you want to permanently delete ${userToDelete.name} (Roll: ${userToDelete.rollNo})?\n\nThis will delete their data from the database. It CANNOT delete their login account.`)) {
                        try {
                            await deleteDoc(doc(db, "users", userIdToDelete));
                            alert('User data deleted from database.');
                            loadUsers(); // Refresh the list
                        } catch (error) {
                            console.error("Error deleting user data:", error);
                            alert("Failed to delete user data.");
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Error loading users:", error);
            userListEl.innerHTML = '<p class="text-red-400">Failed to load users.</p>';
        }
    };

    loadUsers();
}


// --- Other functions ---
function formatDateDDMMYYYY(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}${month}${year}`;
}
async function loadSegregatedAttendanceHistory(db, date) {
    const historyContainerA = document.getElementById('attendance-history-A');
    const historyContainerB = document.getElementById('attendance-history-B');
    const historyContainerAdvanced = document.getElementById('attendance-history-Advanced');

    const containers = [historyContainerA, historyContainerB, historyContainerAdvanced];
    containers.forEach(c => {
        if(c) c.innerHTML = '<p class="text-gray-500 text-sm text-center">No records for this date.</p>';
    });

    const q = query(collection(db, "attendance_logs"), where("date", "==", date));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;
    
    let hasRecords = { A: false, B: false, Advanced: false };

    for (const logDoc of snapshot.docs) {
        const record = logDoc.data();
        const userDoc = await getDoc(doc(db, "users", record.studentId));
        if (!userDoc.exists()) continue;

        const userData = userDoc.data();
        const recordEl = document.createElement('div');
        recordEl.className = 'bg-gray-800 p-2 rounded text-sm mb-2';
        const statusColor = record.status === 'Present' ? 'text-green-400' : 'text-red-400';
        
        const formattedDate = formatDateDDMMYYYY(record.date);

        recordEl.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-bold">${record.studentName}</span>
                <span class="font-bold ${statusColor}">${record.status}</span>
            </div>
            <div class="text-xs text-gray-400">Roll: ${record.rollNo}</div>
            <div class="text-xs text-gray-500 text-right">${formattedDate}</div>
        `;

        if (userData.batch === 'Advanced') {
            if (!hasRecords.Advanced) { historyContainerAdvanced.innerHTML = ''; hasRecords.Advanced = true; }
            historyContainerAdvanced.appendChild(recordEl);
        } else if (userData.division === 'A') {
            if (!hasRecords.A) { historyContainerA.innerHTML = ''; hasRecords.A = true; }
            historyContainerA.appendChild(recordEl);
        } else if (userData.division === 'B') {
            if (!hasRecords.B) { historyContainerB.innerHTML = ''; hasRecords.B = true; }
            historyContainerB.appendChild(recordEl);
        }
    }
}
async function loadStudentAttendance(uid, db) {
    const attendanceRecordEl = document.getElementById('attendance-record');
    if (!attendanceRecordEl) return;
    const attendanceCol = collection(db, `users/${uid}/attendance`);
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
        recordEl.innerHTML = `<span>${record.date}</span><span class="font-bold ${statusColor}">${record.status}</span>`;
        attendanceRecordEl.appendChild(recordEl);
    });
}
async function loadStudentMaterials(batch, db) {
    const materialsList = document.getElementById('materials-list');
    if (!materialsList) return;
    const q = query(collection(db, "materials"), where("targetBatch", "==", batch));
    const querySnapshot = await getDocs(q);
    
    materialsList.innerHTML = '';
    if (querySnapshot.empty) {
        materialsList.innerHTML = '<p class="text-gray-400 col-span-full text-center">No materials available for your batch yet.</p>';
        return;
    }

    const materials = [];
    querySnapshot.forEach((doc) => {
        materials.push(doc.data());
    });
    materials.sort((a, b) => b.uploadedAt.seconds - a.uploadedAt.seconds);

    materials.forEach((material) => {
        const materialCard = `
            <div class="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex-grow">
                    <h3 class="font-bold text-lg text-blue-300">${material.name}</h3>
                    <p class="text-sm text-gray-500">Uploaded: ${new Date(material.uploadedAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <a href="${material.url}" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition">Download</a>
            </div>
        `;
        materialsList.innerHTML += materialCard;
    });
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

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const docId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this material record?')) {
                try {
                    await deleteDoc(doc(db, "materials", docId));
                    await loadAdminMaterials(db);
                } catch (error) {
                    console.error("Delete error: ", error);
                    alert("Could not delete material record.");
                }
            }
        });
    });
}
