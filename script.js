
const TOTAL_SEMESTERS = 8;
const GRADE_POINTS = {
    'A+': 4.0,
    'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
};
const DEFAULT_CREDIT_PER_SUBJECT = 3;

let semesterData = {}; // main data store
let gpaChart = null; // Chart.js instance


function init() {
    checkAuth(); // Auth Check First
    loadFromLocalStorage();
    renderSemesters();
    updateSummary();
    initDarkMode();
    bindSimulatorUI();
    renderGraph(); // Initial graph render
    updatePredictionUI(); // Initial prediction UI
    setupLogout(); // Bind logout
    setupMobileMenu(); // Mobile menu toggle
}
window.addEventListener('DOMContentLoaded', init);

/* ========= Mobile Menu ========= */
function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu');
    const navActions = document.querySelector('.nav-actions');

    if (menuBtn && navActions) {
        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');
            navActions.classList.toggle('active');
        });

        // Close menu when clicking outside (optional but good UX)
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navActions.contains(e.target) && navActions.classList.contains('active')) {
                menuBtn.classList.remove('active');
                navActions.classList.remove('active');
            }
        });

        // Close menu when a button inside is clicked (e.g. logout or dark mode)
        navActions.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navActions.classList.remove('active');
            });
        });
    }
}

/* ========= Auth Logic ========= */
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Update Greeting
    const userData = JSON.parse(user);
    if (document.getElementById('userGreeting')) {
        document.getElementById('userGreeting').textContent = `Hello, ${userData.fullName || 'Scholar'}...!`;
    }
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').style.display = 'inline-block';
    }
}

function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('currentUser');
                window.location.href = 'login.html';
            }
        });
    }
}

/* ========= Tabs ========= */
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    // safe event reference
    try { event.target.classList.add('active'); } catch (e) { }

    // Re-render graph if switching to visualization tab to ensure correct sizing
    if (tabName === 'visualization') {
        renderGraph();
    }
}

/* ========= Semester UI ========= */
function renderSemesters() {
    const container = document.getElementById('semesterContainer');
    container.innerHTML = '';

    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        if (!semesterData[i]) semesterData[i] = { courses: [] };
        container.appendChild(createSemesterCard(i));
    }
}

function createSemesterCard(semesterNum) {
    const semester = semesterData[semesterNum];
    const semesterGPA = calculateSemesterGPA(semesterNum);
    const card = document.createElement('div');
    card.className = 'semester-card';
    card.id = `semester-${semesterNum}`;

    let coursesHTML = semester.courses.length > 0
        ? semester.courses.map((course, idx) => `
        <div class="course-item">
            <div class="course-info">
                <div class="course-name">${escapeHtml(course.name)}</div>
                <div class="course-details">
                    <span>Credits: ${course.credits}</span>
                    <span class="course-grade">${course.grade}</span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteCourse(${semesterNum}, ${idx})">Delete</button>
        </div>
    `).join('')
        : '<div class="empty-state"><div class="empty-state-icon">➕</div>No courses yet</div>';

    card.innerHTML = `
    <div class="semester-header">
        <div class="semester-title">Semester ${semesterNum}</div>
        <div style="display:flex; gap:10px; align-items:center;">
             <button class="pdf-btn" onclick="downloadSemesterPDF(${semesterNum})" title="Download PDF">📄 PDF</button>
             <div class="semester-gpa">GPA: ${semesterGPA.toFixed(2)}</div>
        </div>
    </div>

    <div class="courses-list scrollable-courses">
        ${coursesHTML}
    </div>

    <div class="add-course-form">
        <div class="form-group">
            <label>Course Name</label>
            <input type="text" class="course-name-input" placeholder="e.g., Mathematics">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Grade</label>
                <select class="course-grade-select">
                    <option value="">Select Grade</option>
                    ${Object.keys(GRADE_POINTS).map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Credits</label>
                <input type="number" class="course-credits-input" min="0.5" step="0.5" placeholder="e.g., 3">
            </div>
        </div>
        <button class="add-btn" onclick="addCourse(${semesterNum})">Add Course</button>
    </div>
`;

    return card;
}

function addCourse(semesterNum) {
    const card = document.getElementById(`semester-${semesterNum}`);
    if (!card) return;
    const nameInput = card.querySelector('.course-name-input');
    const gradeSelect = card.querySelector('.course-grade-select');
    const creditsInput = card.querySelector('.course-credits-input');

    if (!nameInput.value.trim() || !gradeSelect.value || !creditsInput.value) {
        alert('Please fill all fields');
        return;
    }

    semesterData[semesterNum].courses.push({
        name: nameInput.value.trim(),
        grade: gradeSelect.value,
        credits: parseFloat(creditsInput.value)
    });

    nameInput.value = '';
    gradeSelect.value = '';
    creditsInput.value = '';

    saveToLocalStorage();
    renderSemesters();
    updateSummary();
}

function deleteCourse(semesterNum, courseIdx) {
    semesterData[semesterNum].courses.splice(courseIdx, 1);
    saveToLocalStorage();
    renderSemesters();
    updateSummary();
}

/* ========= GPA Calculations ========= */
function calculateSemesterGPA(semesterNum) {
    const courses = semesterData[semesterNum].courses;
    if (!courses || courses.length === 0) return 0;
    let totalPoints = 0, totalCredits = 0;
    courses.forEach(course => {
        const gp = GRADE_POINTS[course.grade] || 0;
        totalPoints += gp * course.credits;
        totalCredits += course.credits;
    });
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function updateSummary() {
    let totalCourses = 0, totalGradePoints = 0, totalCredits = 0;
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        const courses = semesterData[i].courses;
        courses.forEach(course => {
            totalCourses++;
            totalCredits += course.credits;
            totalGradePoints += (GRADE_POINTS[course.grade] || 0) * course.credits;
        });
    }
    const overallGPA = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

    document.getElementById('overallGPA').textContent = overallGPA.toFixed(2);
    document.getElementById('totalCourses').textContent = totalCourses;
    document.getElementById('totalCredits').textContent = totalCredits;
    // average credits per semester only counts semesters with data
    let semestersWithCredits = 0;
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) { if ((semesterData[i].courses || []).length > 0) semestersWithCredits++; }
    document.getElementById('avgCredits').textContent = (semestersWithCredits > 0 ? (totalCredits / semestersWithCredits).toFixed(1) : '0');

    // Update graph and prediction whenever summary updates
    renderGraph();
    updatePredictionUI();
}

/* ========= Required Grade & Suggestions ========= */
function calculateRequiredGrade() {
    const currentGPA = parseFloat(document.getElementById('currentGPA').value);
    const targetGPA = parseFloat(document.getElementById('targetGPA').value);
    const completedCredits = parseFloat(document.getElementById('completedCredits').value);
    const remainingCredits = parseFloat(document.getElementById('remainingCredits').value);

    if (isNaN(currentGPA) || isNaN(targetGPA) || isNaN(completedCredits) || isNaN(remainingCredits)) {
        alert('Please fill all fields');
        return;
    }

    const requiredGrade = (targetGPA * (completedCredits + remainingCredits) - currentGPA * completedCredits) / remainingCredits;
    const resultDiv = document.getElementById('checkerResult');
    resultDiv.className = 'checker-result';

    if (requiredGrade > 4.0) {
        resultDiv.innerHTML = `
        <div class="result-item">
            <div class="result-label">Result</div>
            <div class="result-value">❌ Not Possible</div>
            <p>You would need a GPA of ${requiredGrade.toFixed(2)}, which is above 4.0.</p>
        </div>`;
        return;
    }
    if (requiredGrade <= 0) {
        resultDiv.innerHTML = `
        <div class="result-item">
            <div class="result-label">🎉 Already Achieved!</div>
            <div class="result-value">Your current GPA is already higher than target.</div>
        </div>`;
        return;
    }

    const numSubjects = Math.max(1, Math.round(remainingCredits / DEFAULT_CREDIT_PER_SUBJECT)); // fallback to 1
    const plans = generateGradePlans(requiredGrade, numSubjects);

    let planHTML = plans.length > 0 ? plans.map((p, i) => `<div style="margin-bottom:10px;"><b>Plan ${i + 1}</b><br>${p.html}</div>`).join('<hr>') : '<p>No realistic combinations found. Aim for high grades.</p>';

    resultDiv.innerHTML = `
    <div class="result-item">
        <div class="result-label">Required GPA</div>
        <div class="result-value">${requiredGrade.toFixed(2)}</div>
    </div>

    <h3 style="margin-top:20px;">Suggested Grade Plans</h3>
    ${planHTML}

    <div style="margin-top:12px;">
        <button class="add-btn" onclick="openSimulatorFromPlan()">Simulate From Plan</button>
        <button class="add-btn" style="background:#5568d3;margin-left:8px;" onclick="exportCurrentResultAsPDF()">Export Plan as PDF</button>
    </div>
`;

    // store last calculated values to be used by simulator export
    window.__lastRequired = { requiredGrade, numSubjects, plans };
}

/* Generates human-friendly grade plan options */
function generateGradePlans(requiredGPA, numSubjects) {
    // Simplified algorithm: try a set of heuristics (mostly A / mix A-/B+ / all A- etc.)
    const scale = [
        { g: 'A+', v: 4.0 }, { g: 'A', v: 4.0 }, { g: 'A-', v: 3.7 },
        { g: 'B+', v: 3.3 }, { g: 'B', v: 3.0 }, { g: 'B-', v: 2.7 }
    ];
    let plans = [];

    // Plan 1: Highest mix (realistic) - greedy fill with A then A- then B+
    function greedyFill(target) {
        let remaining = numSubjects;
        let arr = [];
        let totalPoints = 0;
        while (remaining > 0) {
            // choose a grade that doesn't drop below target average too much
            if (remaining === numSubjects) { arr.push('A'); totalPoints += 4.0; }
            else if ((totalPoints + (remaining * 3.7)) / numSubjects >= target) { arr.push('A-'); totalPoints += 3.7; }
            else if ((totalPoints + (remaining * 3.3)) / numSubjects >= target) { arr.push('B+'); totalPoints += 3.3; }
            else { arr.push('A'); totalPoints += 4.0; }
            remaining--;
        }
        return arr;
    }

    // Try a few heuristic plans
    const attemptPlans = [];
    attemptPlans.push(greedyFill(requiredGPA));
    // all A- plan
    attemptPlans.push(Array(numSubjects).fill('A-'));
    // mix: some A, some B+
    const half = Math.ceil(numSubjects / 2);
    attemptPlans.push(Array(half).fill('A').concat(Array(numSubjects - half).fill('B+')));
    // strict: all A
    attemptPlans.push(Array(numSubjects).fill('A'));

    // Convert to unique plans and filter those that meet the requiredGPA
    const seen = new Set();
    attemptPlans.forEach(arr => {
        const key = arr.join(',');
        if (seen.has(key)) return; seen.add(key);
        // compute avg value
        const avg = arr.reduce((s, g) => s + (GRADE_POINTS[g] || 0), 0) / arr.length;
        if (avg + 1e-9 >= requiredGPA) {
            // produce human-friendly HTML summary (counts)
            const summary = summarizeGradeArray(arr);
            plans.push({ arr, avg, html: summary });
        }
    });

    // sort by avg ascending (more realistic first)
    plans.sort((a, b) => a.avg - b.avg);
    return plans.slice(0, 5);
}

function summarizeGradeArray(arr) {
    const counts = {};
    arr.forEach(g => counts[g] = (counts[g] || 0) + 1);
    const parts = Object.keys(counts).map(g => `${counts[g]} × ${g}`);
    return parts.join(' • ');
}

/* ========= Interactive Grade Simulator =========
   - Lets user pick subjects/grades and simulates semester + overall GPA
   - UI is built inside Progress tab area when user clicks "Open Simulator"
*/
function bindSimulatorUI() {
    // create simulator container inside the progress tab
    const progressTab = document.getElementById('progress');
    if (!progressTab) return;

    // We'll add a button and an area for simulator results if not present
    if (!document.getElementById('simulatorRoot')) {
        const simHTML = `
        <div style="margin-top:30px; border-top: 1px solid #eee; padding-top: 20px;">
            <button id="openSimulatorBtn" class="add-btn btn-outline" style="width:100%">Open Grade Simulator</button>
            <div id="simulatorRoot" style="margin-top:18px; display:none;">
                <div style="background:#fff;padding:20px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.08); border: 1px solid #eee;">
                    <h3 style="margin-bottom:15px;color:#333;">Grade Simulator</h3>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:220px;">
                            <label style="font-weight:600;">Subjects (count)</label>
                            <input id="simSubjectCount" type="number" min="1" value="5" style="width:100%;padding:8px;margin-top:6px;">
                        </div>
                        <div style="flex:1;min-width:220px;">
                            <label style="font-weight:600;">Credits per subject</label>
                            <input id="simCreditPerSubject" type="number" min="0.5" step="0.5" value="${DEFAULT_CREDIT_PER_SUBJECT}" style="width:100%;padding:8px;margin-top:6px;">
                        </div>
                        <div style="flex:1;min-width:220px;">
                            <label style="font-weight:600;">Preset grade</label>
                            <select id="simPresetGrade" style="width:100%;padding:8px;margin-top:6px;">
                                <option value="">— choose —</option>
                                ${Object.keys(GRADE_POINTS).map(g => `<option value="${g}">${g}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="btn-group">
                        <button class="add-btn" id="createSimSubjectsBtn">Create Subjects</button>
                        <button class="add-btn" style="background:#5568d3" id="simulateBtn">Simulate</button>
                        <button class="add-btn btn-success" id="simulateApplyBtn">Apply to Remaining</button>
                        <button class="add-btn btn-purple" id="exportSimPDFBtn">Export PDF</button>
                    </div>

                    <div id="simSubjectsArea" style="margin-top:12px;"></div>
                    <div id="simResults" style="margin-top:12px;"></div>
                </div>
            </div>
        </div>
    `;
        progressTab.insertAdjacentHTML('beforeend', simHTML);

        document.getElementById('openSimulatorBtn').addEventListener('click', () => {
            const root = document.getElementById('simulatorRoot');
            root.style.display = root.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('createSimSubjectsBtn').addEventListener('click', createSimSubjects);
        document.getElementById('simulateBtn').addEventListener('click', runSimulationFromUI);
        document.getElementById('simulateApplyBtn').addEventListener('click', applySimulationToRemaining);
        document.getElementById('exportSimPDFBtn').addEventListener('click', exportSimulationAsPDF);
    }
}

function createSimSubjects() {
    const count = Math.max(1, parseInt(document.getElementById('simSubjectCount').value) || 1);
    const credit = parseFloat(document.getElementById('simCreditPerSubject').value) || DEFAULT_CREDIT_PER_SUBJECT;
    const preset = document.getElementById('simPresetGrade').value;

    const area = document.getElementById('simSubjectsArea');
    area.innerHTML = '';
    for (let i = 0; iunt; i++) {
        area.insertAdjacentHTML('beforeend', `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <input class="sim-subject-name" placeholder="Subject ${i + 1}" style="flex:1;padding:8px;">
            <select class="sim-subject-grade" style="width:120px;padding:8px;">
                ${Object.keys(GRADE_POINTS).map(g => `<option value="${g}" ${preset === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
            <input class="sim-subject-credit" type="number" value="${credit}" min="0.5" step="0.5" style="width:80px;padding:8px;">
        </div>
    `);
    }
}

function runSimulationFromUI() {
    const names = Array.from(document.querySelectorAll('.sim-subject-name')).map(i => i.value || 'Subject');
    const grades = Array.from(document.querySelectorAll('.sim-subject-grade')).map(i => i.value);
    const credits = Array.from(document.querySelectorAll('.sim-subject-credit')).map(i => parseFloat(i.value) || DEFAULT_CREDIT_PER_SUBJECT);

    const simCourses = names.map((n, idx) => ({ name: n, grade: grades[idx], credits: credits[idx] }));
    const simSemesterGPA = calculateSimSemesterGPA(simCourses);
    const currentOverall = computeOverallGPAFromData();
    const projected = computeProjectedOverallWithSim(simCourses);

    const res = document.getElementById('simResults');
    res.innerHTML = `
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:12px;border-radius:8px;">
        <div style="font-weight:700;font-size:1.1em;">Simulation Results</div>
        <div style="margin-top:8px;">Simulated Semester GPA: <b>${simSemesterGPA.toFixed(2)}</b></div>
        <div>Current Overall GPA: <b>${currentOverall.toFixed(2)}</b></div>
        <div>Projected Overall GPA After Simulation: <b>${projected.toFixed(2)}</b></div>
        <div style="margin-top:8px;font-size:0.9em;">Tip: Click "Apply to Remaining Credits" to turn this simulation into a grade-plan added to a new semester or to remaining credits area.</div>
    </div>
`;
    // store for export / apply
    window.__lastSimulation = { simCourses, simSemesterGPA, projected, currentOverall };
}

function calculateSimSemesterGPA(courses) {
    let totalPoints = 0, totalCredits = 0;
    courses.forEach(c => {
        totalPoints += (GRADE_POINTS[c.grade] || 0) * c.credits;
        totalCredits += c.credits;
    });
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function computeOverallGPAFromData() {
    let totalPoints = 0, totalCredits = 0;
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        semesterData[i].courses.forEach(c => {
            totalPoints += (GRADE_POINTS[c.grade] || 0) * c.credits;
            totalCredits += c.credits;
        });
    }
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function computeProjectedOverallWithSim(simCourses) {
    let totalPoints = 0, totalCredits = 0;
    // current
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        semesterData[i].courses.forEach(c => {
            totalPoints += (GRADE_POINTS[c.grade] || 0) * c.credits;
            totalCredits += c.credits;
        });
    }
    // add simulation
    simCourses.forEach(c => {
        totalPoints += (GRADE_POINTS[c.grade] || 0) * c.credits;
        totalCredits += c.credits;
    });
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

/* Apply simulation: adds a new semester (first empty) with these courses or fill remaining credits */
function applySimulationToRemaining() {
    if (!window.__lastSimulation) {
        alert('Run a simulation first.');
        return;
    }
    // find first semester with no courses, else append to last semester index
    let targetSem = 1;
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        if (!semesterData[i] || semesterData[i].courses.length === 0) { targetSem = i; break; }
        if (i === TOTAL_SEMESTERS) targetSem = TOTAL_SEMESTERS;
    }

    // apply simulated courses into the target semester
    semesterData[targetSem].courses = semesterData[targetSem].courses.concat(window.__lastSimulation.simCourses);
    saveToLocalStorage();
    renderSemesters();
    updateSummary();

    // feedback
    alert('Simulation applied to semester ' + targetSem);
}

/* ========= Export to PDF ========= */
async function exportCurrentResultAsPDF() {
    if (window.__lastRequired) {
        const { requiredGrade, numSubjects, plans } = window.__lastRequired;
        const summary = [
            `Target GPA: ${document.getElementById('targetGPA').value}`,
            `Required Average Grade: ${requiredGrade.toFixed(2)}`,
            `Subjects to take: ${numSubjects}`
        ];

        const tableBody = plans.map((p, i) => [
            `Plan ${i + 1}`,
            p.arr.join(', '),
            p.avg.toFixed(2)
        ]);

        await generateProfessionalPDF('Grade Plan suggestions', summary, {
            head: [['Plan', 'Grade Combination', 'Avg GPA']],
            body: tableBody
        });
    } else {
        alert('No calculated plan to export. Please calculate required grade first.');
    }
}

async function exportSimulationAsPDF() {
    if (!window.__lastSimulation) return alert('No simulation to export.');
    const s = window.__lastSimulation;

    const summary = [
        `Simulated Semester GPA: ${s.simSemesterGPA.toFixed(2)}`,
        `Current Overall GPA: ${s.currentOverall?.toFixed(2) || computeOverallGPAFromData().toFixed(2)}`,
        `Projected Overall GPA: ${s.projected.toFixed(2)}`
    ];

    const tableBody = s.simCourses.map(c => [
        c.name,
        c.grade,
        c.credits.toString()
    ]);

    await generateProfessionalPDF('Simulation Result', summary, {
        head: [['Subject', 'Grade', 'Credits']],
        body: tableBody
    });
}

async function generateProfessionalPDF(title, summaryLines, tableConfig) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Brand / Header
        doc.setFillColor(102, 126, 234); // #667eea
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("GPA Calculator Report", 14, 13);

        // Content Title
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.text(title, 14, 35);

        // Date
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

        // Summary Section
        let startY = 50;
        if (summaryLines && summaryLines.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(0);
            summaryLines.forEach(line => {
                doc.text(line, 14, startY);
                startY += 6;
            });
            startY += 4; // Extra spacing before table
        }

        // Table
        if (tableConfig) {
            doc.autoTable({
                startY: startY,
                head: tableConfig.head,
                body: tableConfig.body,
                theme: 'grid',
                headStyles: { fillColor: [102, 126, 234] },
                styles: { fontSize: 10, cellPadding: 3 }
            });
        }

        doc.save(`${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    } catch (e) {
        console.error(e);
        alert('PDF export failed. Make sure jsPDF and autoTable are loaded.');
    }
}

/* ========= Simple Predictive Estimator =========
   - Uses last N semester GPAs to compute weighted trend
*/
function predictGPAUsingTrend(windowSize = 3) {
    // collect semester GPAs for semesters that have courses (most recent first)
    const gpas = [];
    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        const sem = semesterData[i];
        if (sem && sem.courses && sem.courses.length > 0) gpas.push(calculateSemesterGPA(i));
    }
    if (gpas.length === 0) return null;
    // take last N
    const recent = gpas.slice(-windowSize);
    // weighted average with more weight to recent
    let weightSum = 0, total = 0;
    for (let i = 0; i < recent.length; i++) {
        const w = 1 + i; // increasing weight
        total += recent[i] * w;
        weightSum += w;
    }
    const weightedAvg = total / weightSum;
    // apply a small trend boost/shrink based on slope
    const slope = (recent[recent.length - 1] - recent[0]) / Math.max(1, recent.length - 1 || 1);
    const trendAdjusted = Math.min(4.0, Math.max(0, weightedAvg + slope * 0.2)); // small effect
    return { weightedAvg, slope, trendAdjusted };
}

/* UI helper to show prediction in progress tab */
function showPredictionUI() {
    const container = document.getElementById('checkerResult');
    const p = predictGPAUsingTrend(3);
    if (!p) {
        container.innerHTML += `<div style="margin-top:12px;color:#666;">Not enough data to make a prediction.</div>`;
        return;
    }
    container.innerHTML += `
    <div style="margin-top:12px;" class="checker-result">
        <div class="result-item">
            <div class="result-label">Predicted GPA (trend)</div>
            <div class="result-value">${p.trendAdjusted.toFixed(2)}</div>
        </div>
        <div style="font-size:0.9em;opacity:0.9;margin-top:8px;">
            Based on recent semesters (weighted average ${p.weightedAvg.toFixed(2)}; slope ${p.slope.toFixed(3)}).
        </div>
    </div>
`;
}

/* Called when user clicks "Calculate Required Grade" - show prediction too */
const origCalcBtn = document.querySelector('button[onclick="calculateRequiredGrade()"]');
if (origCalcBtn) {
    origCalcBtn.addEventListener('click', () => {
        // small delay to let existing calc update
        setTimeout(() => { showPredictionUI(); }, 180);
    });
}

/* helper: open simulator and prefill from last plan */
function openSimulatorFromPlan() {
    if (!window.__lastRequired) return alert('Calculate required grade first.');
    const plan = window.__lastRequired.plans && window.__lastRequired.plans[0];
    if (!plan) return alert('No plan available to simulate.');
    document.getElementById('openSimulatorBtn').click();
    // create subjects equal to numSubjects
    const num = window.__lastRequired.numSubjects || 5;
    document.getElementById('simSubjectCount').value = num;
    document.getElementById('simCreditPerSubject').value = DEFAULT_CREDIT_PER_SUBJECT;
    createSimSubjects();
    // parse plan.arr if available
    if (plan.arr) {
        const gradeSelectors = document.querySelectorAll('.sim-subject-grade');
        for (let i = 0; i < gradeSelectors.length; i++) {
            gradeSelectors[i].value = plan.arr[i] || plan.arr[plan.arr.length - 1] || 'A-';
        }
    }
}

/* ========= Local Storage ========= */
function saveToLocalStorage() {
    localStorage.setItem('gpaCalculatorData', JSON.stringify(semesterData));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('gpaCalculatorData');
    if (data) semesterData = JSON.parse(data);
    else {
        for (let i = 1; i <= TOTAL_SEMESTERS; i++) semesterData[i] = { courses: [] };
    }
}

/* ========= Clear ========= */
function clearAllData() {
    if (confirm('Are you sure you want to clear all data?')) {
        for (let i = 1; i <= TOTAL_SEMESTERS; i++) semesterData[i] = { courses: [] };
        saveToLocalStorage();
        renderSemesters();
        updateSummary();
    }
}

/* ========= Dark Mode ========= */
function initDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const saved = localStorage.getItem('gpa_darkmode') === '1';
    setDarkMode(saved);
    btn.addEventListener('click', () => {
        const now = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('gpa_darkmode', now ? '1' : '0');
        setDarkMode(now);
    });
}
function setDarkMode(enabled) {
    if (enabled) {
        document.documentElement.classList.add('dark-mode');
        const btn = document.getElementById('darkModeToggle');
        if (btn) { btn.textContent = '☀️ Light Mode'; btn.style.background = '#667eea'; btn.style.color = '#fff'; }
    } else {
        document.documentElement.classList.remove('dark-mode');
        const btn = document.getElementById('darkModeToggle');
        if (btn) { btn.textContent = '🌙 Dark Mode'; btn.style.background = '#fff'; btn.style.color = '#667eea'; }
    }
}

/* ========= Utilities ========= */
function escapeHtml(s) { return String(s).replace(/[&<>"'\/]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' })[ch]; }); }

/* Expose some functions to window for inline onclick (if needed) */
window.addCourse = addCourse;
window.deleteCourse = deleteCourse;
window.calculateRequiredGrade = calculateRequiredGrade;
window.clearAllData = clearAllData;
window.exportCurrentResultAsPDF = exportCurrentResultAsPDF;
window.downloadSemesterPDF = downloadSemesterPDF;
window.calculatePrediction = calculatePrediction;

/* ========= Graph Visualization ========= */
function renderGraph() {
    const ctx = document.getElementById('gpaChart');
    if (!ctx) return;

    // Prepare data
    const labels = [];
    const dataPoints = [];

    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        labels.push(`Sem ${i}`);
        const sem = semesterData[i];
        if (sem && sem.courses && sem.courses.length > 0) {
            dataPoints.push(calculateSemesterGPA(i));
        } else {
            dataPoints.push(null); // Gap for empty semesters
        }
    }

    // Destroy existing chart if any
    if (gpaChart) {
        gpaChart.destroy();
    }

    gpaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Semester GPA',
                data: dataPoints,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#764ba2',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 4.0,
                    title: { display: true, text: 'GPA' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `GPA: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

/* ========= Semester PDF Download ========= */
async function downloadSemesterPDF(semesterNum) {
    const sem = semesterData[semesterNum];
    if (!sem || !sem.courses || sem.courses.length === 0) {
        alert('No courses in this semester to export.');
        return;
    }

    const gpa = calculateSemesterGPA(semesterNum).toFixed(2);
    const totalCredits = sem.courses.reduce((s, c) => s + c.credits, 0);

    const summary = [
        `Semester GPA: ${gpa}`,
        `Total Credits: ${totalCredits}`
    ];

    const tableBody = sem.courses.map(c => [
        c.name,
        c.grade,
        c.credits.toString()
    ]);

    await generateProfessionalPDF(`Semester ${semesterNum} Report`, summary, {
        head: [['Subject', 'Grade', 'Credits']],
        body: tableBody
    });
}

/* ========= Future GPA Prediction (What-if) ========= */
function updatePredictionUI() {
    const trendArea = document.getElementById('trendPredictionArea');
    if (!trendArea) return;

    const p = predictGPAUsingTrend(TOTAL_SEMESTERS); // Use all available data
    if (!p) {
        trendArea.innerHTML = `<p style="color:#666;">Add some semester data to see trend predictions.</p>`;
        return;
    }

    trendArea.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                <div class="summary-label">Trend-Based Prediction</div>
                <div class="summary-value">${p.trendAdjusted.toFixed(2)}</div>
                <div style="font-size:0.8em; margin-top:5px; opacity:0.9;">Based on past performance</div>
            </div>
             <div class="summary-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                <div class="summary-label">Current CGPA</div>
                <div class="summary-value">${computeOverallGPAFromData().toFixed(2)}</div>
            </div>
        </div>
    `;
}

function calculatePrediction() {
    const futureCredits = parseFloat(document.getElementById('futureCredits').value);
    const expectedGPA = parseFloat(document.getElementById('expectedGPA').value);

    if (isNaN(futureCredits) || isNaN(expectedGPA)) {
        alert('Please enter valid numbers for future credits and expected GPA.');
        return;
    }

    let currentTotalPoints = 0;
    let currentTotalCredits = 0;

    for (let i = 1; i <= TOTAL_SEMESTERS; i++) {
        semesterData[i].courses.forEach(c => {
            currentTotalPoints += (GRADE_POINTS[c.grade] || 0) * c.credits;
            currentTotalCredits += c.credits;
        });
    }

    const futurePoints = expectedGPA * futureCredits;
    const finalTotalPoints = currentTotalPoints + futurePoints;
    const finalTotalCredits = currentTotalCredits + futureCredits;

    const finalCGPA = finalTotalCredits > 0 ? finalTotalPoints / finalTotalCredits : 0;

    const resultDiv = document.getElementById('predictionResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div class="result-item">
            <div class="result-label">Predicted Final CGPA</div>
            <div class="result-value">${finalCGPA.toFixed(2)}</div>
            <p style="margin-top:10px;">If you maintain a ${expectedGPA.toFixed(2)} GPA for the next ${futureCredits} credits.</p>
        </div>
    `;
}
