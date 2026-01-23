// ===================================
// GOOGLE SHEETS CONFIGURATION
// ===================================

const PROJECTS_SPREADSHEET_ID = "18lOZdnclKFFqA-j_DtWbtjFegjn8VUDWVQP9gGPAOA4";
const DEPARTMENT_SHEETS = [
  { name: "Riset", displayName: "Riset" },
  { name: "Digitalisasi", displayName: "Digitalisasi" },
  { name: "System Development", displayName: "System Development" },
];
const PROJECTS_RANGE = "A:M";

const TODO_SPREADSHEET_ID = "1OApZRZFEj-RgtyrFq2wrRCIdUX6Spk6Y-MrGc4fZSOM";
const TODO_SHEET_NAME = "Sheet1";
const TODO_RANGE = "A:I";

const API_KEY = "AIzaSyA2aIyDp9P2NoxsH2efHpANcfKwsWL1RXw";

let projectsData = [];
let departmentData = {};
let todoData = [];
let departmentPieChart = null;
let currentActiveDepartment = "All";

// Filter states for ToDo Modal
let currentStatusFilter = "all";
let currentDepartmentFilterTodo = "all";
let currentCategoryFilter = "all";

document.addEventListener("DOMContentLoaded", function () {
  loadAllData();
  setupEventListeners();
});

// ===================================
// GOOGLE SHEETS DATA LOADING
// ===================================

async function loadAllData() {
  try {
    await Promise.all([loadProjectsData(), loadTodoData()]);
    updateStatistics();
    updateProjectDetails();
    initializeDepartmentChart();
    updateTodoList();
  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data from Google Sheets");
  }
}

async function loadProjectsData() {
  try {
    projectsData = [];
    departmentData = {};

    for (const dept of DEPARTMENT_SHEETS) {
      const sheetData = await loadSheetData(dept.name, dept.displayName);
      departmentData[dept.displayName] = sheetData;
      projectsData.push(...sheetData);
    }

    console.log("✅ All projects data loaded:", projectsData.length, "activities");
  } catch (error) {
    console.error("Error loading projects data:", error);
    throw error;
  }
}

async function loadSheetData(sheetName, departmentName) {
  try {
    const timestamp = new Date().getTime();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PROJECTS_SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${PROJECTS_RANGE}?key=${API_KEY}&_=${timestamp}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.values || data.values.length <= 1) {
      console.warn(`⚠️ No data found in ${sheetName} sheet`);
      return [];
    }

    const headers = data.values[0].map((h) => (h ? h.toString().toLowerCase().trim() : ""));

    const colMap = {
      no: headers.findIndex((h) => h.includes("no") && !h.includes("note")),
      projectType: headers.findIndex((h) => (h.includes("project") && h.includes("type")) || h === "project type" || h === "project"),
      prokerBacklog: headers.findIndex((h) => h.includes("proker") || h.includes("backlog")),
      priority: headers.findIndex((h) => h.includes("priority")),
      aktivitas: headers.findIndex((h) => h.includes("aktivitas") || h.includes("activity")),
      role: headers.findIndex((h) => h.includes("role")),
      mandays: headers.findIndex((h) => h.includes("mandays") || h.includes("man days") || (h.includes("est") && h.includes("day"))),
      status: headers.findIndex((h) => (h.includes("status") && !h.includes("plan") && !h.includes("actual")) || h === "status"),
      plan: headers.findIndex((h) => h === "plan" || (h.includes("plan") && !h.includes("start") && !h.includes("end"))),
      actual: headers.findIndex((h) => h === "actual" || (h.includes("actual") && !h.includes("start") && !h.includes("end"))),
    };

    if (colMap.projectType === -1 || colMap.status === -1) {
      if (colMap.no === -1) colMap.no = 0;
      if (colMap.projectType === -1) colMap.projectType = 1;
      if (colMap.prokerBacklog === -1) colMap.prokerBacklog = 2;
      if (colMap.priority === -1) colMap.priority = 3;
      if (colMap.aktivitas === -1) colMap.aktivitas = 4;
      if (colMap.role === -1) colMap.role = 5;
      if (colMap.mandays === -1) colMap.mandays = 6;
      if (colMap.status === -1) colMap.status = 7;
      if (colMap.plan === -1) colMap.plan = 8;
      if (colMap.actual === -1) colMap.actual = 10;
    }

    const rows = data.values.slice(1);

    let currentProjectType = null;
    let currentProkerBacklog = null;
    let currentPriority = null;

    const sheetActivities = rows
      .map((row, index) => {
        if (row[colMap.projectType] && row[colMap.projectType] !== "-" && row[colMap.projectType].toString().trim() !== "") {
          currentProjectType = row[colMap.projectType];
        }

        if (row[colMap.prokerBacklog] && row[colMap.prokerBacklog] !== "-" && row[colMap.prokerBacklog].toString().trim() !== "") {
          currentProkerBacklog = row[colMap.prokerBacklog];
        }

        if (row[colMap.priority] && row[colMap.priority] !== "-" && row[colMap.priority].toString().trim() !== "") {
          currentPriority = row[colMap.priority];
        }

        if (!row[colMap.aktivitas] || row[colMap.aktivitas] === "-" || row[colMap.aktivitas].toString().trim() === "") {
          return null;
        }

        const aktivitasStr = row[colMap.aktivitas].toString().toLowerCase();
        const isTotalRow = aktivitasStr.includes("total mandays");

        const item = {
          no: row[colMap.no] || "-",
          projectType: currentProjectType || "-",
          prokerBacklog: currentProkerBacklog || "-",
          priority: currentPriority || "-",
          aktivitas: row[colMap.aktivitas] || "-",
          role: row[colMap.role] || "-",
          mandays: parseFloat(row[colMap.mandays]) || 0,
          status: normalizeStatus(row[colMap.status]),
          planStart: row[colMap.plan] || "-",
          planEnd: row[colMap.plan + 1] || "-",
          actualStart: row[colMap.actual] || "-",
          actualEnd: row[colMap.actual + 1] || "-",
          departemen: departmentName,
          pic: "-",
          projectId: `${departmentName}_${currentProjectType}_${currentProkerBacklog}`.replace(/\s+/g, "_"),
          isTotalRow: isTotalRow,
        };

        return item;
      })
      .filter((task) => task !== null && task.projectType !== "-" && task.projectType && task.aktivitas !== "-");

    console.log(`✅ ${sheetName} loaded: ${sheetActivities.length} activities`);

    return sheetActivities;
  } catch (error) {
    console.error(`Error loading ${sheetName}:`, error);
    return [];
  }
}

async function loadTodoData() {
  try {
    const timestamp = new Date().getTime();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TODO_SPREADSHEET_ID}/values/${TODO_SHEET_NAME}!${TODO_RANGE}?key=${API_KEY}&_=${timestamp}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.values && data.values.length > 1) {
      const headers = data.values[0];
      const rows = data.values.slice(1);

      console.log("📋 Headers:", headers);
      console.log("📋 Total rows:", rows.length);

      todoData = rows
        .map((row, index) => {
          // PERBAIKAN: Pastikan category diambil dengan benar dan tidak kosong
          let category = "Uncategorized";
          if (row[3] && row[3] !== "-" && row[3].toString().trim() !== "") {
            category = row[3].toString().trim();
          }

          const task = {
            no: row[0] || "-",
            tipe: row[1] || "-",
            departemen: row[2] || "-",
            category: category,
            item: row[4] || "-",
            pic: row[5] || "-",
            startDate: row[6] || "-",
            endDate: row[7] || "-",
            status: normalizeStatus(row[8]),
          };

          // Debug logging untuk RKAP
          if (row[3] && row[3].toString().toLowerCase().includes("rkap")) {
            console.log(`🔍 FOUND RKAP at row ${index}:`, {
              rawCategory: row[3],
              category: task.category,
              item: task.item,
              departemen: task.departemen,
            });
          }

          return task;
        })
        .filter((task) => {
          const hasValidItem = task.item !== "-" && task.item && task.item.toString().trim() !== "";
          if (!hasValidItem && task.category !== "Uncategorized") {
            console.log(`⚠️ Filtered out task with category "${task.category}" - no valid item`);
          }
          return hasValidItem;
        });

      console.log("✅ To-Do data loaded:", todoData.length, "items");
      console.log("⏰ Loaded at:", new Date().toLocaleTimeString());

      // Log category distribution untuk debugging
      const categoryDist = {};
      todoData.forEach((task) => {
        categoryDist[task.category] = (categoryDist[task.category] || 0) + 1;
      });
      console.log("📋 Category distribution:", categoryDist);

      // Cari RKAP di hasil akhir
      const rkapTasks = todoData.filter((t) => t.category.toLowerCase().includes("rkap"));
      console.log("🔍 RKAP tasks in final data:", rkapTasks.length, rkapTasks);
    }
  } catch (error) {
    console.error("Error loading to-do data:", error);
    throw error;
  }
}

function normalizeStatus(status) {
  if (!status || status === "-" || status === "NaN" || status === "nan" || status.toString().trim() === "") {
    return "Outstanding";
  }

  const statusLower = status.toString().toLowerCase().trim();

  if (statusLower === "done" || statusLower === "completed" || statusLower === "complete") {
    return "Complete";
  } else if (statusLower === "in progress" || statusLower === "progress") {
    return "In Progress";
  } else {
    return "Outstanding";
  }
}

// ===================================
// STATISTICS UPDATE
// ===================================

function updateStatistics() {
  if (projectsData.length === 0) {
    console.log("No projects data available for statistics");
    return;
  }

  const projectGroups = {};
  const regularActivities = projectsData.filter((task) => !task.isTotalRow);

  regularActivities.forEach((task) => {
    const id = task.projectId;
    if (id && id !== "-_-" && id !== "--") {
      if (!projectGroups[id]) {
        projectGroups[id] = {
          id: id,
          projectType: task.projectType,
          prokerBacklog: task.prokerBacklog,
          departemen: task.departemen,
          activities: [],
          totalMandays: 0,
        };
      }
      projectGroups[id].activities.push(task);
      projectGroups[id].totalMandays += task.mandays || 0;
    }
  });

  const projects = Object.values(projectGroups);

  const totalProjects = projects.length;
  document.getElementById("totalProjects").textContent = totalProjects;

  let completedCount = 0;
  let progressCount = 0;

  projects.forEach((project) => {
    const allComplete = project.activities.every((act) => act.status === "Complete");
    const hasProgress = project.activities.some((act) => act.status === "In Progress");
    const hasComplete = project.activities.some((act) => act.status === "Complete");

    if (allComplete) {
      completedCount++;
    } else if (hasProgress || hasComplete) {
      progressCount++;
    }
  });

  document.getElementById("completedProjects").textContent = completedCount;
  document.getElementById("inProgressProjects").textContent = progressCount;

  const totalMandays = projects.reduce((sum, project) => sum + project.totalMandays, 0);
  document.getElementById("totalMandays").textContent = totalMandays.toFixed(0);

  console.log("📊 Statistics Updated:");
  console.log("- Total Projects:", totalProjects);
  console.log("- Completed Projects:", completedCount);
  console.log("- In Progress Projects:", progressCount);
}

// ===================================
// PROJECT DETAILS UPDATE
// ===================================

function updateProjectDetails(departmentFilter = "All") {
  const detailsList = document.getElementById("projectDetailsList");
  currentActiveDepartment = departmentFilter;

  const deptLabel = document.getElementById("activeDeptLabel");
  if (deptLabel) {
    deptLabel.textContent = departmentFilter === "All" ? "All Departments" : departmentFilter;

    if (departmentFilter === "All") {
      deptLabel.style.background = "#f97316";
      deptLabel.style.boxShadow = "0 4px 8px rgba(249, 115, 22, 0.3)";
    } else if (departmentFilter === "Riset") {
      deptLabel.style.background = "#8b5cf6";
      deptLabel.style.boxShadow = "0 4px 8px rgba(139, 92, 246, 0.3)";
    } else if (departmentFilter === "Digitalisasi") {
      deptLabel.style.background = "#3b82f6";
      deptLabel.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.3)";
    } else if (departmentFilter === "System Development") {
      deptLabel.style.background = "#10b981";
      deptLabel.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.3)";
    }
  }

  if (projectsData.length === 0) {
    detailsList.innerHTML = '<div class="no-data">No projects available</div>';
    return;
  }

  let filteredActivities = projectsData.filter((task) => !task.isTotalRow);
  if (departmentFilter !== "All") {
    filteredActivities = filteredActivities.filter((task) => task.departemen === departmentFilter);
  }

  const projectGroups = {};

  filteredActivities.forEach((task) => {
    const id = task.projectId;
    if (id && id !== "-_-" && id !== "--") {
      if (!projectGroups[id]) {
        projectGroups[id] = {
          id: id,
          projectType: task.projectType,
          prokerBacklog: task.prokerBacklog,
          departemen: task.departemen,
          activities: [],
          totalMandays: 0,
          completed: 0,
          inProgress: 0,
          outstanding: 0,
        };
      }
      projectGroups[id].activities.push(task);
      projectGroups[id].totalMandays += task.mandays || 0;
      if (task.status === "Complete") projectGroups[id].completed++;
      else if (task.status === "In Progress") projectGroups[id].inProgress++;
      else projectGroups[id].outstanding++;
    }
  });

  const projects = Object.values(projectGroups);

  let completeProjects = 0;
  let progressProjects = 0;
  let outstandingProjects = 0;

  projects.forEach((project) => {
    const allComplete = project.activities.every((act) => act.status === "Complete");
    const hasComplete = project.activities.some((act) => act.status === "Complete");
    const hasInProgress = project.activities.some((act) => act.status === "In Progress");

    if (allComplete) {
      completeProjects++;
    } else if (hasInProgress || hasComplete) {
      progressProjects++;
    } else {
      outstandingProjects++;
    }
  });

  document.getElementById("summaryCompleteCount").textContent = completeProjects;
  document.getElementById("summaryProgressCount").textContent = progressProjects;
  document.getElementById("summaryOutstandingCount").textContent = outstandingProjects;

  let htmlContent = "";

  if (projects.length === 0) {
    htmlContent += '<div class="no-data" style="margin-top: 20px;">No projects in this department</div>';
  } else {
    const displayProjects = projects.slice(0, 5);

    htmlContent += displayProjects
      .map(
        (project) => `
      <div class="detail-item" data-project-id="${escapeHtml(project.id)}" onclick="showProjectActivitiesModal('${escapeHtml(project.id)}')">
        <div class="detail-item-header">
          <div class="detail-item-icon">
            <i class="fas fa-folder"></i>
          </div>
          <div class="detail-item-info">
            <h4>${escapeHtml(project.projectType)}</h4>
            <span class="detail-item-count">${escapeHtml(project.prokerBacklog)} • ${escapeHtml(project.departemen)}</span>
          </div>
        </div>
        <div class="detail-item-meta">
          <span class="detail-meta-badge"><i class="fas fa-tasks"></i> ${project.activities.length} activities</span>
        </div>
        <div class="detail-item-stats">
          <div class="detail-stat">
            <span class="detail-stat-label">Complete</span>
            <span class="detail-stat-value">${project.completed}</span>
          </div>
          <div class="detail-stat">
            <span class="detail-stat-label">In Progress</span>
            <span class="detail-stat-value">${project.inProgress}</span>
          </div>
          <div class="detail-stat">
            <span class="detail-stat-label">Est. Days</span>
            <span class="detail-stat-value">${project.totalMandays.toFixed(0)}</span>
          </div>
        </div>
        <div class="detail-item-progress">
          <div class="progress-bar-wrapper">
            <div class="progress-bar-fill" style="width: ${project.activities.length > 0 ? ((project.completed / project.activities.length) * 100).toFixed(0) : 0}%"></div>
          </div>
          <span class="progress-percentage">${project.activities.length > 0 ? ((project.completed / project.activities.length) * 100).toFixed(0) : 0}%</span>
        </div>
      </div>
    `,
      )
      .join("");
  }

  detailsList.innerHTML = htmlContent;
  updateLegendActiveStates();
}

// ===================================
// DEPARTMENT DETAIL FUNCTION
// ===================================

function showDepartmentDetail(departmentName) {
  console.log("🔘 Clicked department:", departmentName);
  updateProjectDetails(departmentName);
  // PERBAIKAN: TIDAK update todo list, hanya update project details
  updateLegendActiveStates();
}

function updateLegendActiveStates() {
  document.querySelectorAll(".legend-item").forEach((item) => {
    item.classList.remove("active");
  });

  const legendItems = document.querySelectorAll(".legend-item");
  legendItems.forEach((item) => {
    const onclick = item.getAttribute("onclick");
    if (onclick) {
      if (currentActiveDepartment === "All" && onclick.includes("'All'")) {
        item.classList.add("active");
      } else if (onclick.includes(`'${currentActiveDepartment}'`)) {
        item.classList.add("active");
      }
    }
  });
}

function showProjectActivitiesModal(projectId) {
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  const activities = projectsData.filter((task) => task.projectId === projectId);

  if (activities.length === 0) {
    console.error("No activities found for project:", projectId);
    return;
  }

  const projectInfo = activities[0];

  const modalTitle = modal.querySelector(".modal-header h2");
  modalTitle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="back-btn" onclick="backToProjectsList()" style="margin: 0; padding: 10px 16px;">
        <i class="fas fa-arrow-left"></i> Back
      </button>
      <div>
        <i class="fas fa-folder-open"></i> ${escapeHtml(projectInfo.projectType)}
        <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-left: 8px;">
          • ${escapeHtml(projectInfo.prokerBacklog)} • ${escapeHtml(projectInfo.departemen)}
        </span>
      </div>
    </div>
  `;

  const filtersDiv = modal.querySelector(".detail-filters");
  if (filtersDiv) {
    filtersDiv.style.display = "none";
  }

  let displayActivities = activities;

  const content = document.getElementById("detailModalContent");

  if (displayActivities.length === 0) {
    content.innerHTML = `
      <div class="no-data">
        <p>No activities found</p>
        <p style="font-size: 12px; margin-top: 8px;">Total activities in this project: ${activities.length}</p>
      </div>
    `;
  } else {
    const regularActivities = displayActivities.filter((act) => !act.isTotalRow);
    const totalRows = displayActivities.filter((act) => act.isTotalRow);

    const activitiesHTML = regularActivities
      .map((activity) => {
        let priorityText = activity.priority;
        let priorityClass = "priority-medium";

        if (activity.priority === "1" || activity.priority === 1) {
          priorityText = "High";
          priorityClass = "priority-high";
        } else if (activity.priority === "2" || activity.priority === 2) {
          priorityText = "Medium";
          priorityClass = "priority-medium";
        } else if (activity.priority === "3" || activity.priority === 3) {
          priorityText = "Low";
          priorityClass = "priority-low";
        } else if (activity.priority.toString().toLowerCase() === "high") {
          priorityText = "High";
          priorityClass = "priority-high";
        } else if (activity.priority.toString().toLowerCase() === "medium") {
          priorityText = "Medium";
          priorityClass = "priority-medium";
        } else if (activity.priority.toString().toLowerCase() === "low") {
          priorityText = "Low";
          priorityClass = "priority-low";
        }

        return `
      <div class="activity-item-modal">
        <div class="activity-header">
          <div class="activity-title-row">
            <h4><i class="fas fa-tasks"></i> ${escapeHtml(activity.aktivitas)}</h4>
            <span class="todo-item-status status-${activity.status.toLowerCase().replace(" ", "-")}">${activity.status}</span>
          </div>
          <div class="activity-badges">
            <span class="activity-badge ${priorityClass}">
              <i class="fas fa-exclamation-circle"></i> ${priorityText}
            </span>
            <span class="activity-badge role-badge">
              <i class="fas fa-user-tag"></i> ${escapeHtml(activity.role)}
            </span>
            <span class="activity-badge mandays-badge">
              <i class="fas fa-clock"></i> ${activity.mandays} days
            </span>
          </div>
        </div>
        
        <div class="activity-details">
          <div class="activity-timeline">
            <div class="timeline-section">
              <div class="timeline-header">
                <i class="fas fa-calendar-check"></i> Planned Timeline
              </div>
              <div class="timeline-dates">
                <span class="timeline-date">
                  <strong>Start:</strong> ${activity.planStart !== "-" ? formatDate(activity.planStart) : "Not set"}
                </span>
                <span class="timeline-separator">→</span>
                <span class="timeline-date">
                  <strong>End:</strong> ${activity.planEnd !== "-" ? formatDate(activity.planEnd) : "Not set"}
                </span>
              </div>
            </div>
            
            <div class="timeline-section">
              <div class="timeline-header">
                <i class="fas fa-calendar-alt"></i> Actual Timeline
              </div>
              <div class="timeline-dates">
                <span class="timeline-date">
                  <strong>Start:</strong> ${activity.actualStart !== "-" ? formatDate(activity.actualStart) : "Not started"}
                </span>
                <span class="timeline-separator">→</span>
                <span class="timeline-date">
                  <strong>End:</strong> ${activity.actualEnd !== "-" ? formatDate(activity.actualEnd) : "Not finished"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
      })
      .join("");

    const totalRowsHTML = totalRows
      .map(
        (activity) => `
      <div class="activity-item-modal activity-total-row">
        <div class="activity-header">
          <div class="activity-title-row">
            <h4><i class="fas fa-calculator"></i> ${escapeHtml(activity.aktivitas)}</h4>
          </div>
        </div>
        <div class="total-mandays-display">
          <span class="total-label">Total Mandays</span>
          <span class="total-value">${activity.mandays} days</span>
        </div>
      </div>
    `,
      )
      .join("");

    content.innerHTML = `
      <div class="activities-grid-2col">
        ${activitiesHTML}
      </div>
      ${
        totalRows.length > 0
          ? `
        <div class="total-rows-grid-2col">
          ${totalRowsHTML}
        </div>
      `
          : ""
      }
    `;
  }

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function backToProjectsList() {
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  const modalTitle = modal.querySelector(".modal-header h2");
  modalTitle.innerHTML = '<i class="fas fa-list-alt"></i> All Projects';

  const filtersDiv = modal.querySelector(".detail-filters");
  if (filtersDiv) filtersDiv.style.display = "flex";

  document.querySelectorAll("[data-status]").forEach((btn) => {
    if (btn.getAttribute("data-status") === "all") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  filterDetailModal();
}

function formatDate(dateString) {
  if (!dateString || dateString === "-") return "-";

  try {
    let date;

    if (dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        if (day > 12) {
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(year, month - 1, day);
        }
      }
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return dateString;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day.toString().padStart(2, "0")} ${month} ${year}`;
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return dateString;
  }
}

// ===================================
// TODO LIST UPDATE - CATEGORY BASED DESIGN - FIXED
// ===================================

function updateTodoList() {
  const todoList = document.getElementById("todoList");

  if (todoData.length === 0) {
    todoList.innerHTML = '<div class="no-data">No tasks available</div>';
    return;
  }

  todoList.innerHTML = "";

  // PERBAIKAN: Filter berdasarkan department yang dipilih
  let filteredTodoData = todoData;
  if (currentDepartmentFilterTodo !== "all") {
    filteredTodoData = todoData.filter((task) => task.departemen === currentDepartmentFilterTodo);
  }

  // Group tasks by category DENGAN URUTAN KEMUNCULAN
  const tasksByCategory = {};
  const categoryOrder = []; // Track urutan kemunculan

  filteredTodoData.forEach((task) => {
    const category = task.category;
    if (!tasksByCategory[category]) {
      tasksByCategory[category] = [];
      categoryOrder.push(category); // Simpan urutan pertama kali muncul
    }
    tasksByCategory[category].push(task);
  });

  // PERBAIKAN: Sort - Uncategorized selalu di akhir, sisanya tetap urutan kemunculan
  const categories = categoryOrder.sort((a, b) => {
    // Uncategorized selalu paling akhir
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;

    // Sisanya pertahankan urutan kemunculan (stable sort)
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });

  console.log("📋 Categories found (named categories first):", categories);
  console.log("📋 Total categories:", categories.length);
  console.log(
    "📋 Category breakdown:",
    categories.map((cat) => `${cat}: ${tasksByCategory[cat].length} tasks`),
  );

  // PERBAIKAN: Cek apakah RKAP ada
  const hasRKAP = categories.some((cat) => cat.toLowerCase().includes("rkap"));
  console.log("🔍 Has RKAP in categories?", hasRKAP);
  if (hasRKAP) {
    const rkapCategory = categories.find((cat) => cat.toLowerCase().includes("rkap"));
    console.log("✅ RKAP category found:", rkapCategory, "with", tasksByCategory[rkapCategory].length, "tasks");
    console.log("✅ RKAP position in list:", categories.indexOf(rkapCategory) + 1, "of", categories.length);
  }

  // Tampilkan maksimal 6 kategori untuk preview (agar Uncategorized juga muncul)
  const displayCategories = categories.slice(0, 6);
  const hasMoreCategories = categories.length > 6;

  // PERBAIKAN: Hitung total tasks yang tidak ditampilkan
  let hiddenTasksCount = 0;
  if (hasMoreCategories) {
    for (let i = 6; i < categories.length; i++) {
      hiddenTasksCount += tasksByCategory[categories[i]].length;
    }
  }

  console.log("📊 Displaying categories:", displayCategories);
  console.log("📊 Hidden categories count:", categories.length - 5);
  console.log("📊 Hidden tasks count:", hiddenTasksCount);

  displayCategories.forEach((category) => {
    const tasks = tasksByCategory[category];
    const task = tasks[0];
    const todoItem = createCategoryTodoItem(category, task, tasks.length);
    todoList.appendChild(todoItem);
  });

  // PERBAIKAN: Ubah indikator untuk menampilkan jumlah tasks, bukan categories
  if (hasMoreCategories) {
    const moreIndicator = document.createElement("div");
    moreIndicator.className = "more-categories-indicator";
    moreIndicator.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <span>+${hiddenTasksCount} more tasks in ${categories.length - 6} categories. Click "View All Tasks" to see everything.</span>
    `;
    todoList.appendChild(moreIndicator);
  }
}

function createCategoryTodoItem(category, task, totalTasks) {
  const div = document.createElement("div");
  div.className = "todo-category-card";

  const isComplete = task.status === "Complete";
  if (isComplete) {
    div.classList.add("completed");
  }

  div.setAttribute("data-status", task.status);
  div.setAttribute("data-department", task.departemen);
  div.setAttribute("data-end-date", task.endDate);
  div.setAttribute("data-category", category);

  const statusClass = task.status.toLowerCase().replace(" ", "-");

  const startDateFormatted = task.startDate !== "-" ? formatDateFull(task.startDate) : "-";
  const endDateFormatted = task.endDate !== "-" ? formatDateFull(task.endDate) : "-";

  let dateDisplayText = "";
  let dateRangeText = "";

  if (task.startDate === "-" && task.endDate === "-") {
    dateDisplayText = "Not Started";
    dateRangeText = "";
  } else if (task.startDate !== "-" && task.endDate !== "-") {
    dateDisplayText = "Scheduled";
    dateRangeText = `${startDateFormatted} - ${endDateFormatted}`;
  } else if (task.startDate !== "-") {
    dateDisplayText = "Started";
    dateRangeText = startDateFormatted;
  } else {
    dateDisplayText = "Deadline";
    dateRangeText = endDateFormatted;
  }

  const picName = task.pic && task.pic !== "-" ? task.pic : "Unassigned";
  const itemText = task.item || "";

  div.innerHTML = `
    <div class="todo-category-header">
      <div class="todo-category-left">
        <div class="todo-category-checkbox ${isComplete ? "checked" : ""}">
          ${isComplete ? '<i class="fas fa-check"></i>' : ""}
        </div>
        <div class="todo-category-info">
          <h4 class="todo-category-title ${isComplete ? "strikethrough" : ""}">${escapeHtml(category)}</h4>
          <p class="todo-category-subtitle">${escapeHtml(task.departemen)}</p>
        </div>
      </div>
    </div>
    
    <div class="todo-category-preview">
      <p class="preview-text">${escapeHtml(itemText)}</p>
    </div>
    
    <div class="todo-category-footer">
      <div class="todo-category-date">
        <i class="fas fa-calendar"></i>
        <span class="date-label">${dateDisplayText}</span>
        ${dateRangeText ? `<span class="todo-date-time">${dateRangeText}</span>` : ""}
      </div>
    </div>
    <div class="todo-category-pic">
      <i class="fas fa-user"></i>
      <span class="pic-name">${escapeHtml(picName)}</span>
      ${totalTasks > 1 ? `<span class="task-count">+${totalTasks - 1} more</span>` : ""}
    </div>
  `;

  // PERBAIKAN: Saat klik category card, bawa filter department yang aktif
  div.addEventListener("click", () => {
    showCategoryDetailModal(category);
  });

  return div;
}

function getInitials(name) {
  if (!name || name === "-") return "?";

  const words = name.trim().split(" ");
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function formatDateFull(dateString) {
  if (!dateString || dateString === "-") return "-";

  try {
    let date;
    if (dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      }
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return dateString;

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const day = date.getDate().toString().padStart(2, "0");
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateString;
  }
}

function formatDateShort(dateString) {
  if (!dateString || dateString === "-") return "-";

  try {
    let date;
    if (dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      }
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return dateString;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();

    return `${month} ${day}`;
  } catch (e) {
    return dateString;
  }
}

function showCategoryDetailModal(category) {
  // PERBAIKAN: Filter tasks berdasarkan category DAN department yang aktif
  let categoryTasks = todoData.filter((task) => {
    return task.category === category;
  });

  // Apply department filter jika ada
  if (currentDepartmentFilterTodo !== "all") {
    categoryTasks = categoryTasks.filter((task) => task.departemen === currentDepartmentFilterTodo);
  }

  if (categoryTasks.length === 0) {
    console.error("No tasks found for category:", category);
    return;
  }

  const modal = document.getElementById("todoModal");
  if (!modal) return;

  // Update modal title
  const modalTitle = modal.querySelector(".modal-header h2");
  modalTitle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <i class="fas fa-folder-open"></i> ${escapeHtml(category)}
      <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-left: 8px;">
        • ${categoryTasks.length} task${categoryTasks.length > 1 ? "s" : ""}
      </span>
    </div>
  `;

  // PERBAIKAN: Tampilkan filters dengan filter status
  const filtersDiv = modal.querySelector(".modal-filters");
  if (filtersDiv) {
    filtersDiv.innerHTML = `
      <div class="filter-group">
        <label class="filter-label"> <i class="fas fa-filter"></i> Filter by Status </label>
        <div class="filter-chips">
          <button class="filter-chip-modal active" data-status="all" onclick="filterCategoryTasks('all')">All</button>
          <button class="filter-chip-modal" data-status="Complete" onclick="filterCategoryTasks('Complete')"><i class="fas fa-check-circle"></i> Complete</button>
          <button class="filter-chip-modal" data-status="In Progress" onclick="filterCategoryTasks('In Progress')"><i class="fas fa-spinner"></i> In Progress</button>
          <button class="filter-chip-modal" data-status="Outstanding" onclick="filterCategoryTasks('Outstanding')"><i class="fas fa-clock"></i> Outstanding</button>
        </div>
      </div>
    `;
    filtersDiv.style.display = "flex";
  }

  // Reset status filter
  currentStatusFilter = "all";

  // Update stats
  const totalCount = categoryTasks.length;
  const completeCount = categoryTasks.filter((t) => t.status === "Complete").length;
  const progressCount = categoryTasks.filter((t) => t.status === "In Progress").length;
  const outstandingCount = categoryTasks.filter((t) => t.status === "Outstanding").length;

  document.getElementById("totalTasksCount").textContent = totalCount;
  document.getElementById("completeTasksCount").textContent = completeCount;
  document.getElementById("progressTasksCount").textContent = progressCount;
  document.getElementById("outstandingTasksCount").textContent = outstandingCount;

  // Store category for filtering
  window.currentCategoryForModal = category;

  // Render tasks
  const content = document.getElementById("todoModalContent");
  if (categoryTasks.length === 0) {
    content.innerHTML = '<div class="no-data">No tasks found in this category</div>';
  } else {
    content.innerHTML = categoryTasks.map((task) => createTodoModalCard(task)).join("");
  }

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

// PERBAIKAN: Function baru untuk filter tasks dalam category modal
function filterCategoryTasks(status) {
  currentStatusFilter = status;

  // Update active button
  document.querySelectorAll(".filter-chip-modal[data-status]").forEach((btn) => {
    if (btn.getAttribute("data-status") === status) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Get base category tasks
  let categoryTasks = todoData.filter((task) => {
    return task.category === window.currentCategoryForModal;
  });

  // Apply department filter
  if (currentDepartmentFilterTodo !== "all") {
    categoryTasks = categoryTasks.filter((task) => task.departemen === currentDepartmentFilterTodo);
  }

  // PERBAIKAN: Stats dihitung dari tasks yang SUDAH difilter by status
  let displayTasks = categoryTasks;
  if (status !== "all") {
    displayTasks = categoryTasks.filter((task) => task.status === status);
  }

  // Update stats berdasarkan filtered tasks
  const totalCount = displayTasks.length;
  const completeCount = displayTasks.filter((t) => t.status === "Complete").length;
  const progressCount = displayTasks.filter((t) => t.status === "In Progress").length;
  const outstandingCount = displayTasks.filter((t) => t.status === "Outstanding").length;

  document.getElementById("totalTasksCount").textContent = totalCount;
  document.getElementById("completeTasksCount").textContent = completeCount;
  document.getElementById("progressTasksCount").textContent = progressCount;
  document.getElementById("outstandingTasksCount").textContent = outstandingCount;

  // Render filtered tasks
  const content = document.getElementById("todoModalContent");
  if (displayTasks.length === 0) {
    content.innerHTML = '<div class="no-data">No tasks found with the selected filter</div>';
  } else {
    content.innerHTML = displayTasks.map((task) => createTodoModalCard(task)).join("");
  }
}

function formatItemText(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped.replace(/\n/g, "<br>").replace(/\r\n/g, "<br>");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// CHART INITIALIZATION WITH LOADING STATE
// ===================================

function initializeDepartmentChart() {
  const ctx = document.getElementById("departmentPieChart");
  const loadingState = document.getElementById("chartLoadingState");

  if (!ctx) return;

  const projectGroups = {};
  const regularActivities = projectsData.filter((task) => !task.isTotalRow);

  regularActivities.forEach((task) => {
    const id = task.projectId;
    if (id && id !== "-_-" && id !== "--") {
      projectGroups[id] = task.departemen;
    }
  });

  const deptCounts = {};
  Object.values(projectGroups).forEach((dept) => {
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  const risetCount = deptCounts["Riset"] || 0;
  const digitalisasiCount = deptCounts["Digitalisasi"] || 0;
  const systemCount = deptCounts["System Development"] || 0;
  const totalCount = risetCount + digitalisasiCount + systemCount;

  document.getElementById("allCount").textContent = totalCount;
  document.getElementById("risetCount").textContent = risetCount;
  document.getElementById("digitalisasiCount").textContent = digitalisasiCount;
  document.getElementById("systemCount").textContent = systemCount;

  if (departmentPieChart) {
    departmentPieChart.destroy();
  }

  setTimeout(() => {
    departmentPieChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Riset", "Digitalisasi", "System Development"],
        datasets: [
          {
            data: [risetCount, digitalisasiCount, systemCount],
            backgroundColor: ["#8b5cf6", "#3b82f6", "#10b981"],
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            const departmentNames = ["Riset", "Digitalisasi", "System Development"];
            const clickedDepartment = departmentNames[index];
            showDepartmentDetail(clickedDepartment);
          }
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            padding: 16,
            titleFont: {
              size: 15,
              weight: "bold",
              family: "Outfit",
            },
            bodyFont: {
              size: 14,
              family: "Manrope",
            },
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed || 0;
                return `${label}: ${value} projects`;
              },
            },
          },
        },
        cutout: "0%",
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 1000,
          easing: "easeInOutQuart",
        },
        interaction: {
          mode: "nearest",
          intersect: true,
        },
      },
    });

    loadingState.style.display = "none";
    ctx.style.display = "block";

    updateLegendActiveStates();
  }, 800);
}

// ===================================
// TODO FILTER WITH END DATE - CATEGORY BASED
// ===================================

function applyFilters() {
  const departmentFilter = document.getElementById("departmentFilter").value;
  const endDateFilter = document.getElementById("endDateFilter").value;

  // PERBAIKAN: Update currentDepartmentFilterTodo
  currentDepartmentFilterTodo = departmentFilter;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let filteredData = todoData;

  // Apply department filter
  if (departmentFilter !== "all") {
    filteredData = filteredData.filter((task) => task.departemen === departmentFilter);
  }

  // Apply end date filter
  if (endDateFilter !== "all") {
    filteredData = filteredData.filter((task) => {
      if (task.endDate === "-") return false;

      const endDate = parseDate(task.endDate);
      if (!endDate) return false;

      const diffTime = endDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (endDateFilter) {
        case "overdue":
          return diffDays < 0;
        case "today":
          return diffDays === 0;
        case "this-week":
          return diffDays >= 0 && diffDays <= 7;
        case "this-month":
          return diffDays >= 0 && diffDays <= 30;
        case "upcoming":
          return diffDays > 30;
        default:
          return true;
      }
    });
  }

  // Group by category DENGAN URUTAN KEMUNCULAN
  const tasksByCategory = {};
  const categoryOrder = [];

  filteredData.forEach((task) => {
    const category = task.category;
    if (!tasksByCategory[category]) {
      tasksByCategory[category] = [];
      categoryOrder.push(category);
    }
    tasksByCategory[category].push(task);
  });

  // PERBAIKAN: Sort - Uncategorized selalu di akhir
  const sortedCategories = categoryOrder.sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });

  const categories = sortedCategories.slice(0, 6);
  const hasMoreCategories = sortedCategories.length > 6;

  // PERBAIKAN: Hitung total tasks yang tidak ditampilkan
  let hiddenTasksCount = 0;
  if (hasMoreCategories) {
    for (let i = 6; i < sortedCategories.length; i++) {
      hiddenTasksCount += tasksByCategory[sortedCategories[i]].length;
    }
  }

  const todoList = document.getElementById("todoList");
  todoList.innerHTML = "";

  if (categories.length === 0) {
    todoList.innerHTML = '<div class="no-data">No tasks found with selected filters</div>';
  } else {
    categories.forEach((category) => {
      const tasks = tasksByCategory[category];
      const task = tasks[0];
      const todoItem = createCategoryTodoItem(category, task, tasks.length);
      todoList.appendChild(todoItem);
    });

    if (hasMoreCategories) {
      const moreIndicator = document.createElement("div");
      moreIndicator.className = "more-categories-indicator";
      moreIndicator.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <span>+${hiddenTasksCount} more tasks in ${sortedCategories.length - 6} categories. Click "View All Tasks" to see everything.</span>
      `;
      todoList.appendChild(moreIndicator);
    }
  }
}

function parseDate(dateString) {
  if (!dateString || dateString === "-") return null;

  try {
    if (dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    return new Date(dateString);
  } catch (e) {
    return null;
  }
}

// ===================================
// DETAIL MODAL FUNCTIONS
// ===================================

function showDetailModal() {
  const modal = document.getElementById("detailModal");
  if (modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    populateDetailModal();
  }
}

function closeDetailModal() {
  const modal = document.getElementById("detailModal");
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "auto";

    const modalTitle = modal.querySelector(".modal-header h2");
    modalTitle.innerHTML = '<i class="fas fa-list-alt"></i> All Projects';

    const filtersDiv = modal.querySelector(".detail-filters");
    if (filtersDiv) {
      filtersDiv.style.display = "flex";
    }

    document.querySelectorAll("[data-status]").forEach((btn) => {
      if (btn.getAttribute("data-status") === "all") {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

function populateDetailModal() {
  const modal = document.getElementById("detailModal");
  const modalTitle = modal.querySelector(".modal-header h2");
  modalTitle.innerHTML = '<i class="fas fa-list-alt"></i> All Projects';

  const uniqueStatuses = ["Complete", "In Progress", "Outstanding"];

  const filtersDiv = modal.querySelector(".detail-filters");
  if (filtersDiv) {
    filtersDiv.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Status</label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="filter-chip active" data-status="all" onclick="filterDetailModalByStatus('all')">All</button>
            ${uniqueStatuses.map((status) => `<button class="filter-chip" data-status="${escapeHtml(status)}" onclick="filterDetailModalByStatus('${escapeHtml(status)}')">${escapeHtml(status)}</button>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  filterDetailModal();
}

function filterDetailModalByStatus(status) {
  console.log("🔘 Clicking Status:", status);

  document.querySelectorAll("[data-status]").forEach((btn) => {
    if (btn.getAttribute("data-status") === status) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  setTimeout(() => {
    filterDetailModal();
  }, 10);
}

function filterDetailModal() {
  const modal = document.getElementById("detailModal");
  const activeStatusBtn = modal.querySelector("[data-status].active");

  const statusFilter = activeStatusBtn ? activeStatusBtn.getAttribute("data-status") : "all";

  console.log("=== FILTER DETAIL MODAL ===");
  console.log("🔍 Active Status Button:", activeStatusBtn?.textContent, "| Value:", statusFilter);

  const allProjectGroups = {};
  const regularActivities = projectsData.filter((task) => !task.isTotalRow);

  regularActivities.forEach((task) => {
    const id = task.projectId;
    if (id && id !== "-_-" && id !== "--") {
      if (!allProjectGroups[id]) {
        allProjectGroups[id] = {
          id: id,
          projectType: task.projectType,
          prokerBacklog: task.prokerBacklog,
          departemen: task.departemen,
          activities: [],
          totalMandays: 0,
          completed: 0,
          inProgress: 0,
          outstanding: 0,
        };
      }
      allProjectGroups[id].activities.push(task);
      allProjectGroups[id].totalMandays += task.mandays || 0;
      if (task.status === "Complete") allProjectGroups[id].completed++;
      else if (task.status === "In Progress") allProjectGroups[id].inProgress++;
      else allProjectGroups[id].outstanding++;
    }
  });

  let filteredProjects = Object.values(allProjectGroups);
  console.log("📊 Total projects before filter:", filteredProjects.length);

  if (statusFilter !== "all") {
    const beforeStatusFilter = filteredProjects.length;
    filteredProjects = filteredProjects.filter((project) => {
      const allComplete = project.activities.every((act) => act.status === "Complete");
      const hasComplete = project.activities.some((act) => act.status === "Complete");
      const hasInProgress = project.activities.some((act) => act.status === "In Progress");

      let match = false;
      if (statusFilter === "Complete") {
        match = allComplete;
      } else if (statusFilter === "In Progress") {
        match = (hasInProgress || hasComplete) && !allComplete;
      } else if (statusFilter === "Outstanding") {
        match = !hasComplete && !hasInProgress;
      }

      return match;
    });
    console.log(`📊 After status filter (${statusFilter}):`, beforeStatusFilter, "→", filteredProjects.length, "projects");
  }

  console.log("=== FINAL RESULT:", filteredProjects.length, "projects ===\n");

  const content = document.getElementById("detailModalContent");

  if (filteredProjects.length === 0) {
    content.innerHTML = '<div class="no-data">No projects found with the selected filters</div>';
    return;
  }

  content.innerHTML = filteredProjects
    .map(
      (project) => `
    <div class="detail-item-modal" onclick="showProjectActivitiesModal('${escapeHtml(project.id)}')" style="cursor: pointer;">
      <div class="detail-modal-header">
        <div class="detail-modal-type">
          <i class="fas fa-folder"></i>
          <strong>${escapeHtml(project.projectType)}</strong>
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-left: 8px;">• ${escapeHtml(project.prokerBacklog)} • ${escapeHtml(project.departemen)}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">${project.activities.length} activities</span>
          <i class="fas fa-chevron-right" style="color: var(--primary-blue); font-size: 12px;"></i>
        </div>
      </div>
      <div class="detail-modal-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px;">
        <div class="detail-stat">
          <span class="detail-stat-label">Complete</span>
          <span class="detail-stat-value">${project.completed}</span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label">In Progress</span>
          <span class="detail-stat-value">${project.inProgress}</span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label">Est. Days</span>
          <span class="detail-stat-value">${project.totalMandays.toFixed(0)}</span>
        </div>
      </div>
      <div class="detail-item-progress" style="margin-top: 12px;">
        <div class="progress-bar-wrapper">
          <div class="progress-bar-fill" style="width: ${project.activities.length > 0 ? ((project.completed / project.activities.length) * 100).toFixed(0) : 0}%"></div>
        </div>
        <span class="progress-percentage">${project.activities.length > 0 ? ((project.completed / project.activities.length) * 100).toFixed(0) : 0}%</span>
      </div>
    </div>
  `,
    )
    .join("");
}

// ===================================
// TODO MODAL FUNCTIONS - COMPLETELY REDESIGNED
// ===================================

function showTodoModal() {
  const modal = document.getElementById("todoModal");
  if (modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    currentStatusFilter = "all";
    currentCategoryFilter = "all";

    updateTodoModalContent();
  }
}

function closeTodoModal() {
  const modal = document.getElementById("todoModal");
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "auto";

    const modalTitle = modal.querySelector(".modal-header h2");
    modalTitle.innerHTML = '<i class="fas fa-tasks"></i> Task Management';

    const filtersDiv = modal.querySelector(".modal-filters");
    if (filtersDiv) {
      filtersDiv.style.display = "flex";
    }

    currentStatusFilter = "all";
    currentCategoryFilter = "all";
    window.currentCategoryForModal = null;

    document.querySelectorAll("[data-status]").forEach((btn) => {
      if (btn.getAttribute("data-status") === "all") {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    document.querySelectorAll("[data-category]").forEach((btn) => {
      if (btn.getAttribute("data-category") === "all") {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

function filterTodoModal(filterType, value) {
  if (filterType === "status") {
    currentStatusFilter = value;

    document.querySelectorAll(".filter-chip-modal[data-status]").forEach((btn) => {
      if (btn.getAttribute("data-status") === value) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  } else if (filterType === "category") {
    currentCategoryFilter = value;

    document.querySelectorAll(".filter-chip-modal[data-category]").forEach((btn) => {
      if (btn.getAttribute("data-category") === value) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  updateTodoModalContent();
}

function updateTodoModalContent() {
  // PERBAIKAN: Filter berdasarkan department yang aktif
  let baseFilteredTasks = todoData;

  if (currentDepartmentFilterTodo !== "all") {
    baseFilteredTasks = todoData.filter((task) => task.departemen === currentDepartmentFilterTodo);
  }

  // Apply filters untuk display
  let displayTasks = baseFilteredTasks;

  if (currentStatusFilter !== "all") {
    displayTasks = displayTasks.filter((task) => task.status === currentStatusFilter);
  }

  if (currentCategoryFilter !== "all") {
    displayTasks = displayTasks.filter((task) => task.category === currentCategoryFilter);
  }

  // PERBAIKAN: Stats dihitung dari tasks yang sudah difilter (display tasks)
  const totalCount = displayTasks.length;
  const completeCount = displayTasks.filter((t) => t.status === "Complete").length;
  const progressCount = displayTasks.filter((t) => t.status === "In Progress").length;
  const outstandingCount = displayTasks.filter((t) => t.status === "Outstanding").length;

  document.getElementById("totalTasksCount").textContent = totalCount;
  document.getElementById("completeTasksCount").textContent = completeCount;
  document.getElementById("progressTasksCount").textContent = progressCount;
  document.getElementById("outstandingTasksCount").textContent = outstandingCount;

  const content = document.getElementById("todoModalContent");

  if (displayTasks.length === 0) {
    content.innerHTML = '<div class="no-data">No tasks found with the selected filters</div>';
    return;
  }

  content.innerHTML = displayTasks.map((task) => createTodoModalCard(task)).join("");

  // PERBAIKAN: Update filters untuk menampilkan kategori yang tersedia
  const filtersDiv = document.querySelector(".modal-filters");
  if (filtersDiv && !window.currentCategoryForModal) {
    // Get unique categories from base filtered data (before status/category filter)
    const categoryOrder = [];
    const categoriesSet = new Set();

    baseFilteredTasks.forEach((task) => {
      if (!categoriesSet.has(task.category)) {
        categoriesSet.add(task.category);
        categoryOrder.push(task.category);
      }
    });

    // PERBAIKAN: Sort categories - Uncategorized di akhir
    const sortedCategories = categoryOrder.sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
    });

    filtersDiv.innerHTML = `
      <div class="filter-group">
        <label class="filter-label"> <i class="fas fa-filter"></i> Filter by Status </label>
        <div class="filter-chips">
          <button class="filter-chip-modal ${currentStatusFilter === "all" ? "active" : ""}" data-status="all" onclick="filterTodoModal('status', 'all')">All</button>
          <button class="filter-chip-modal ${currentStatusFilter === "Complete" ? "active" : ""}" data-status="Complete" onclick="filterTodoModal('status', 'Complete')"><i class="fas fa-check-circle"></i> Complete</button>
          <button class="filter-chip-modal ${currentStatusFilter === "In Progress" ? "active" : ""}" data-status="In Progress" onclick="filterTodoModal('status', 'In Progress')"><i class="fas fa-spinner"></i> In Progress</button>
          <button class="filter-chip-modal ${currentStatusFilter === "Outstanding" ? "active" : ""}" data-status="Outstanding" onclick="filterTodoModal('status', 'Outstanding')"><i class="fas fa-clock"></i> Outstanding</button>
        </div>
      </div>
      
      <div class="filter-group">
        <label class="filter-label"> <i class="fas fa-tag"></i> Filter by Category </label>
        <div class="filter-chips" style="max-height: 120px; overflow-y: auto; padding: 4px;">
          <button class="filter-chip-modal ${currentCategoryFilter === "all" ? "active" : ""}" data-category="all" onclick="filterTodoModal('category', 'all')">All Categories</button>
          ${sortedCategories
            .map(
              (cat) => `
            <button class="filter-chip-modal ${currentCategoryFilter === cat ? "active" : ""}" data-category="${escapeHtml(cat)}" onclick="filterTodoModal('category', '${escapeHtml(cat)}')">${escapeHtml(cat)}</button>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }
}

function createTodoModalCard(task) {
  const statusClass = task.status.toLowerCase().replace(" ", "-");
  const statusIcon = task.status === "Complete" ? "fa-check-circle" : task.status === "In Progress" ? "fa-spinner" : "fa-clock";

  return `
    <div class="todo-card-redesigned">
      <div class="todo-card-header-new">
        <div class="todo-status-badge-new status-${statusClass}">
          <i class="fas ${statusIcon}"></i>
          <span>${task.status}</span>
        </div>
        <div class="todo-card-dept-badge">
          <i class="fas fa-building"></i>
          ${escapeHtml(task.departemen)}
        </div>
      </div>
      
      <div class="todo-card-body-new">
        <h3 class="todo-card-title-new">${formatItemText(task.item)}</h3>
        
        <!-- PERBAIKAN: Category dipindah ke atas, full width seperti timeline -->
        <div class="todo-card-category-full">
          <div class="category-icon-new">
            <i class="fas fa-tag"></i>
          </div>
          <div class="category-content-new">
            <div class="category-label-new">Category</div>
            <div class="category-value-new">${escapeHtml(task.category)}</div>
          </div>
        </div>
        
        <div class="todo-card-info-grid">
          <div class="info-item-new">
            <div class="info-label-new">
              <i class="fas fa-bookmark"></i>
              Tipe
            </div>
            <div class="info-value-new">${escapeHtml(task.tipe)}</div>
          </div>
          
          <div class="info-item-new">
            <div class="info-label-new">
              <i class="fas fa-user"></i>
              PIC
            </div>
            <div class="info-value-new">${escapeHtml(task.pic)}</div>
          </div>
        </div>
        
        <div class="todo-timeline-new">
          <div class="timeline-item-new">
            <div class="timeline-icon-new">
              <i class="fas fa-play-circle"></i>
            </div>
            <div class="timeline-content-new">
              <div class="timeline-label-new">Start Date</div>
              <div class="timeline-value-new">${task.startDate !== "-" ? formatDate(task.startDate) : "Not set"}</div>
            </div>
          </div>
          
          <div class="timeline-divider-new">
            <i class="fas fa-arrow-right"></i>
          </div>
          
          <div class="timeline-item-new">
            <div class="timeline-icon-new">
              <i class="fas fa-flag-checkered"></i>
            </div>
            <div class="timeline-content-new">
              <div class="timeline-label-new">End Date</div>
              <div class="timeline-value-new">${task.endDate !== "-" ? formatDate(task.endDate) : "Not set"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===================================
// EVENT LISTENERS
// ===================================

function setupEventListeners() {
  window.addEventListener("click", function (event) {
    const todoModal = document.getElementById("todoModal");
    const detailModal = document.getElementById("detailModal");

    if (event.target === todoModal) {
      closeTodoModal();
    }
    if (event.target === detailModal) {
      closeDetailModal();
    }
  });
}

// ===================================
// ERROR HANDLING
// ===================================

function showError(message) {
  const todoList = document.getElementById("todoList");
  if (todoList) {
    todoList.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
      </div>
    `;
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

function showDebugInfo() {
  console.log("=== DEBUG INFO ===");
  console.log("Projects Data Sample:", projectsData.slice(0, 5));
  console.log(
    "Department Data:",
    Object.keys(departmentData).map((dept) => `${dept}: ${departmentData[dept].length} activities`),
  );
  console.log("Todo Data Sample:", todoData.slice(0, 5));
  console.log("Total Projects:", projectsData.length);
  console.log("Total Todos:", todoData.length);

  const uniqueTypes = [...new Set(projectsData.map((t) => t.projectType).filter((t) => t && t !== "-"))];
  console.log("Unique Project Types:", uniqueTypes);

  const statusBreakdown = projectsData.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  console.log("Status Breakdown:", statusBreakdown);

  const categories = [...new Set(todoData.map((t) => t.category))];
  console.log("Unique Categories:", categories);
  console.log("Current Department Filter:", currentDepartmentFilterTodo);

  alert("Debug info logged to console. Press F12 to view.");
}

function refreshDashboard() {
  loadAllData();
}
