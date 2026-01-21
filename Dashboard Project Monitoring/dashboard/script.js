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
const TODO_RANGE = "A:I"; // Updated range to include new columns

const API_KEY = "AIzaSyA2aIyDp9P2NoxsH2efHpANcfKwsWL1RXw";

let projectsData = [];
let departmentData = {};
let todoData = [];
let departmentPieChart = null;
let currentActiveDepartment = "All";

// Filter states for ToDo Modal
let currentStatusFilter = "all";
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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${PROJECTS_SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${PROJECTS_RANGE}?key=${API_KEY}`;

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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TODO_SPREADSHEET_ID}/values/${TODO_SHEET_NAME}!${TODO_RANGE}?key=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.values && data.values.length > 1) {
      const headers = data.values[0];
      const rows = data.values.slice(1);

      todoData = rows
        .map((row) => ({
          no: row[0] || "-",
          tipe: row[1] || "-",
          departemen: row[2] || "-",
          category: row[3] || "-", // NEW: Category
          item: row[4] || "-",
          pic: row[5] || "-",
          startDate: row[6] || "-", // NEW: Start Date
          endDate: row[7] || "-", // NEW: End Date
          status: normalizeStatus(row[8]), // Status moved to column 9
        }))
        .filter((task) => task.item !== "-" && task.item);

      console.log("✅ To-Do data loaded:", todoData.length, "items");

      // Populate category filter
      populateCategoryFilters();
    }
  } catch (error) {
    console.error("Error loading to-do data:", error);
    throw error;
  }
}

function populateCategoryFilters() {
  // Get unique categories
  const categories = [...new Set(todoData.map((task) => task.category))].filter((cat) => cat !== "-").sort();

  // Populate home filter
  const homeFilter = document.getElementById("categoryFilterHome");
  if (homeFilter) {
    homeFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      homeFilter.appendChild(option);
    });
  }

  // Populate modal filter
  const modalFilterChips = document.getElementById("categoryFilterChips");
  if (modalFilterChips) {
    let html = '<button class="filter-chip-modal active" data-category="all" onclick="filterTodoModal(\'category\', \'all\')">All Categories</button>';
    categories.forEach((cat) => {
      html += `<button class="filter-chip-modal" data-category="${escapeHtml(cat)}" onclick="filterTodoModal('category', '${escapeHtml(cat)}')">${escapeHtml(cat)}</button>`;
    });
    modalFilterChips.innerHTML = html;
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

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

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
// TODO LIST UPDATE - IMPROVED
// ===================================

function updateTodoList() {
  const todoList = document.getElementById("todoList");

  if (todoData.length === 0) {
    todoList.innerHTML = '<div class="no-data">No tasks available</div>';
    return;
  }

  todoList.innerHTML = "";

  todoData.forEach((task) => {
    const todoItem = createTodoItem(task);
    todoList.appendChild(todoItem);
  });

  updateTodoCount();
}

function createTodoItem(task) {
  const div = document.createElement("div");
  div.className = "todo-item";

  div.setAttribute("data-status", task.status);
  div.setAttribute("data-department", task.departemen);
  div.setAttribute("data-category", task.category);

  const isChecked = task.status === "Complete";
  if (isChecked) {
    div.classList.add("checked");
  }

  const formattedItem = formatItemText(task.item);

  div.innerHTML = `
    <input type="checkbox" ${isChecked ? "checked" : ""} />
    <div class="todo-item-content">
      <div class="todo-item-title">${formattedItem}</div>
      <div class="todo-item-meta">
        <span class="todo-item-pic"><i class="fas fa-user"></i> ${escapeHtml(task.pic)}</span>
        ${task.category !== "-" ? `<span class="todo-item-category"><i class="fas fa-tag"></i> ${escapeHtml(task.category)}</span>` : ""}
      </div>
      <span class="todo-item-status status-${task.status.toLowerCase().replace(" ", "-")}">${task.status}</span>
    </div>
  `;

  div.onclick = function () {
    toggleTodoItem(this);
  };

  return div;
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
// CHART INITIALIZATION
// ===================================

function initializeDepartmentChart() {
  const ctx = document.getElementById("departmentPieChart");
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

  updateLegendActiveStates();
}

// ===================================
// TODO LIST INTERACTIONS
// ===================================

function toggleTodoItem(element) {
  const checkbox = element.querySelector('input[type="checkbox"]');
  checkbox.checked = !checkbox.checked;

  if (checkbox.checked) {
    element.classList.add("checked");
  } else {
    element.classList.remove("checked");
  }

  updateTodoCount();
}

function updateTodoCount() {
  const todoList = document.getElementById("todoList");
  if (!todoList) return;

  const visibleItems = todoList.querySelectorAll(".todo-item:not(.hidden)");
  const uncheckedCount = Array.from(visibleItems).filter((item) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    return checkbox && !checkbox.checked;
  }).length;

  const todoCountEl = document.getElementById("todoCount");
  if (todoCountEl) {
    todoCountEl.textContent = uncheckedCount;
  }

  const badge = document.querySelector(".todo-count-badge");
  const deptFilter = document.getElementById("departmentFilter")?.value || "all";
  const catFilter = document.getElementById("categoryFilterHome")?.value || "all";

  let filterText = "";
  if (deptFilter !== "all" || catFilter !== "all") {
    const filters = [];
    if (deptFilter !== "all") filters.push(deptFilter);
    if (catFilter !== "all") filters.push(catFilter);
    filterText = ` (${filters.join(", ")})`;
  }

  if (badge) {
    badge.innerHTML = `<span id="todoCount">${uncheckedCount}</span> tasks pending${filterText}`;
  }
}

// ===================================
// TODO FILTER
// ===================================

function applyFilters() {
  const departmentFilter = document.getElementById("departmentFilter").value;
  const categoryFilter = document.getElementById("categoryFilterHome").value;

  const todoList = document.getElementById("todoList");
  if (!todoList) return;

  const todoItems = todoList.querySelectorAll(".todo-item");

  todoItems.forEach((item) => {
    const itemDept = item.getAttribute("data-department");
    const itemCategory = item.getAttribute("data-category");

    let passDeptFilter = departmentFilter === "all" || itemDept === departmentFilter;
    let passCategoryFilter = categoryFilter === "all" || itemCategory === categoryFilter;

    if (passDeptFilter && passCategoryFilter) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });

  updateTodoCount();
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
// TODO MODAL FUNCTIONS - IMPROVED
// ===================================

function showTodoModal() {
  const modal = document.getElementById("todoModal");
  if (modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    // Reset filters
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
  }
}

function filterTodoModal(filterType, value) {
  if (filterType === "status") {
    currentStatusFilter = value;

    // Update active button
    document.querySelectorAll("[data-status]").forEach((btn) => {
      if (btn.getAttribute("data-status") === value) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  } else if (filterType === "category") {
    currentCategoryFilter = value;

    // Update active button
    document.querySelectorAll("[data-category]").forEach((btn) => {
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
  let filteredTasks = todoData;

  // Apply status filter
  if (currentStatusFilter !== "all") {
    filteredTasks = filteredTasks.filter((task) => task.status === currentStatusFilter);
  }

  // Apply category filter
  if (currentCategoryFilter !== "all") {
    filteredTasks = filteredTasks.filter((task) => task.category === currentCategoryFilter);
  }

  // Update stats
  const totalCount = filteredTasks.length;
  const outstandingCount = filteredTasks.filter((t) => t.status === "Outstanding").length;
  const progressCount = filteredTasks.filter((t) => t.status === "In Progress").length;
  const completeCount = filteredTasks.filter((t) => t.status === "Complete").length;

  document.getElementById("totalTasksCount").textContent = totalCount;
  document.getElementById("outstandingTasksCount").textContent = outstandingCount;
  document.getElementById("progressTasksCount").textContent = progressCount;
  document.getElementById("completeTasksCount").textContent = completeCount;

  // Render tasks
  const content = document.getElementById("todoModalContent");

  if (filteredTasks.length === 0) {
    content.innerHTML = '<div class="no-data">No tasks found with the selected filters</div>';
    return;
  }

  content.innerHTML = filteredTasks.map((task) => createTodoModalCard(task)).join("");
}

function createTodoModalCard(task) {
  const statusClass = task.status.toLowerCase().replace(" ", "-");
  const statusIcon = task.status === "Complete" ? "fa-check-circle" : task.status === "In Progress" ? "fa-spinner" : "fa-clock";

  return `
    <div class="todo-card-modal">
      <div class="todo-card-header">
        <div class="todo-card-status status-${statusClass}">
          <i class="fas ${statusIcon}"></i>
          <span>${task.status}</span>
        </div>
        ${task.category !== "-" ? `<div class="todo-card-category"><i class="fas fa-tag"></i> ${escapeHtml(task.category)}</div>` : ""}
      </div>
      
      <div class="todo-card-body">
        <h4 class="todo-card-title">${formatItemText(task.item)}</h4>
        
        <div class="todo-card-info-grid">
          <div class="info-item">
            <span class="info-icon"><i class="fas fa-hashtag"></i></span>
            <div class="info-content">
              <span class="info-label">No</span>
              <span class="info-value">${escapeHtml(task.no)}</span>
            </div>
          </div>
          
          <div class="info-item">
            <span class="info-icon"><i class="fas fa-tag"></i></span>
            <div class="info-content">
              <span class="info-label">Tipe</span>
              <span class="info-value">${escapeHtml(task.tipe)}</span>
            </div>
          </div>
          
          <div class="info-item">
            <span class="info-icon"><i class="fas fa-building"></i></span>
            <div class="info-content">
              <span class="info-label">Departemen</span>
              <span class="info-value">${escapeHtml(task.departemen)}</span>
            </div>
          </div>
          
          <div class="info-item">
            <span class="info-icon"><i class="fas fa-user"></i></span>
            <div class="info-content">
              <span class="info-label">PIC</span>
              <span class="info-value">${escapeHtml(task.pic)}</span>
            </div>
          </div>
        </div>
        
        <div class="todo-card-timeline">
          <div class="timeline-item">
            <i class="fas fa-calendar-check"></i>
            <div class="timeline-content">
              <span class="timeline-label">Start Date</span>
              <span class="timeline-value">${task.startDate !== "-" ? formatDate(task.startDate) : "Not set"}</span>
            </div>
          </div>
          <div class="timeline-separator">→</div>
          <div class="timeline-item">
            <i class="fas fa-calendar-times"></i>
            <div class="timeline-content">
              <span class="timeline-label">End Date</span>
              <span class="timeline-value">${task.endDate !== "-" ? formatDate(task.endDate) : "Not set"}</span>
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

  const categories = [...new Set(todoData.map((t) => t.category))].filter((c) => c !== "-");
  console.log("Unique Categories:", categories);

  alert("Debug info logged to console. Press F12 to view.");
}

function refreshDashboard() {
  loadAllData();
}
