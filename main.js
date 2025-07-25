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
            else if (currentPage === 'admin.html') initAdminDashboard(db);
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
    
    initCalendar();
    loadStudentAttendance(uid, db);
    loadStudentMaterials(userData.batch, db);
}

async function initAdminDashboard(db) {
    const addMaterialForm = document.getElementById('add-material-form');
    if (addMaterialForm) {
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
    }

    const attendanceForm = document.getElementById('attendance-form');
    const rollNoInput = document.getElementById('student-rollno');
    const dateInput = document.getElementById('attendance-date');
    const statusSelect = document.getElementById('attendance-status');
    const nameConfirmEl = document.getElementById('student-name-confirm');
    const attendanceButton = document.getElementById('mark-attendance-button');

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

            if (!date) return; // Don't check for attendance if date is not set

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

    if (attendanceForm) {
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
                loadAttendanceHistory(db);
            } catch (error) {
                statusEl.textContent = error.message;
            } finally {
                attendanceButton.disabled = false;
                setTimeout(() => statusEl.textContent = '', 3000);
            }
        });
    }

    loadAdminMaterials(db);
    loadAttendanceHistory(db);
}

function initCalendar() {
    const monthYearEl = document.getElementById('month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const calendarGrid = document.getElementById('calendar-grid');
    if (!monthYearEl || !prevMonthBtn || !nextMonthBtn || !calendarGrid) return;

    let currentDate = new Date();

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        monthYearEl.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const dayNameCell = document.createElement('div');
            dayNameCell.className = 'day-name';
            dayNameCell.textContent = day;
            calendarGrid.appendChild(dayNameCell);
        });

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'empty-cell';
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell p-1';
            dayCell.textContent = day;
            const dayDate = new Date(year, month, day);
            if (dayDate.getDay() === 4) { // Thursday
                dayCell.classList.add('thursday');
            }
            calendarGrid.appendChild(dayCell);
        }
    }

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
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

async function loadAttendanceHistory(db) {
    const historyEl = document.getElementById('attendance-history');
    if (!historyEl) return;
    const q = query(collection(db, "attendance_logs"), orderBy("markedAt", "desc"), limit(10));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        historyEl.innerHTML = '<p class="text-gray-400 text-center">No recent records.</p>';
        return;
    }

    historyEl.innerHTML = '';
    snapshot.forEach(doc => {
        const record = doc.data();
        const recordEl = document.createElement('div');
        recordEl.className = 'bg-gray-800 p-2 rounded text-sm';
        const statusColor = record.status === 'Present' ? 'text-green-400' : 'text-red-400';
        recordEl.innerHTML = `
            <div>
                <span class="font-bold">${record.studentName}</span> (Roll: ${record.rollNo})
            </div>
            <div class="flex justify-between items-center text-xs text-gray-400">
                <span>${record.date}</span>
                <span class="font-bold ${statusColor}">${record.status}</span>
            </div>
        `;
        historyEl.appendChild(recordEl);
    });
}
