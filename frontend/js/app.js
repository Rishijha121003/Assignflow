/**
 * AssignFlow - Assignment Management Platform
 * Frontend Vanilla JavaScript Client
 * Handles real-time API communication with FastAPI & PostgreSQL
 */

// API Base configuration
const API_BASE = window.location.origin.includes("http") && !window.location.origin.includes(":5500")
  ? ""
  : "http://127.0.0.1:8000";

const API_ENDPOINTS = {
  dashboard: `${API_BASE}/api/dashboard`,
  assignments: `${API_BASE}/api/assignments`,
  submissions: `${API_BASE}/api/submissions`,
  health: `${API_BASE}/api/health`,
  authMe: `${API_BASE}/api/auth/me`,
  authLogin: `${API_BASE}/api/auth/login`,
  authRegister: `${API_BASE}/api/auth/register`,
  authLogout: `${API_BASE}/api/auth/logout`,
  classes: `${API_BASE}/api/classes`,
  joinClass: `${API_BASE}/api/classes/join`,
};

// Application State
const state = {
  currentUser: null,
  assignments: [],
  filteredAssignments: [],
  classes: [],
  mySubmissions: {}, // assignment_id -> submission object or null
  submissionsData: [], // list of submissions for Submissions page
  filters: {
    search: "",
    classId: "all",
    subject: "all",
    status: "all",
    sort: "newest",
  },
  editingId: null,
  deletePendingId: null,
  currentSubmittingAssignment: null,
  authMode: "signin",
  activeView: "dashboard",
  currentGradingAssignment: null,
  currentGradingSubmissions: [],
  currentGradingIndex: 0,
  pendingSingleReleaseSubId: null,
  isGradingSaving: false,
  selectedSubmissionIds: new Set(),
};

// DOM Elements Cache
const elements = {
  // Navigation & Layout
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  menuToggleBtn: document.getElementById("menuToggleBtn"),
  sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
  navLinks: document.querySelectorAll(".nav-link"),
  globalSearchInput: document.getElementById("globalSearchInput"),
  notificationBtn: document.getElementById("notificationBtn"),
  profileBtn: document.getElementById("profileBtn"),
  profileDropdownWrapper: document.getElementById("profileDropdownWrapper"),
  profileAvatarText: document.getElementById("profileAvatarText"),
  profileMenu: document.getElementById("profileMenu"),
  profileMenuAvatar: document.getElementById("profileMenuAvatar"),
  profileMenuName: document.getElementById("profileMenuName"),
  profileMenuEmail: document.getElementById("profileMenuEmail"),
  profileMenuRole: document.getElementById("profileMenuRole"),
  menuSwitchAccountBtn: document.getElementById("menuSwitchAccountBtn"),
  menuLogoutBtn: document.getElementById("menuLogoutBtn"),
  sidebarProfileWidget: document.getElementById("sidebarProfileWidget"),
  sidebarAvatar: document.getElementById("sidebarAvatar"),
  sidebarUserName: document.getElementById("sidebarUserName"),
  sidebarUserRole: document.getElementById("sidebarUserRole"),
  sidebarSignOutBtn: document.getElementById("sidebarSignOutBtn"),
  navDashboard: document.getElementById("navDashboard"),
  navAssignments: document.getElementById("navAssignments"),
  navClasses: document.getElementById("navClasses"),
  navSubmissions: document.getElementById("navSubmissions"),
  navCalendar: document.getElementById("navCalendar"),
  navAnalytics: document.getElementById("navAnalytics"),
  navSettings: document.getElementById("navSettings"),
  navTextAssignments: document.getElementById("navTextAssignments"),
  navTextClasses: document.getElementById("navTextClasses"),
  navTextSubmissions: document.getElementById("navTextSubmissions"),
  navTextAnalytics: document.getElementById("navTextAnalytics"),

  // Multi-Page View Elements
  dashboardView: document.getElementById("dashboardView"),
  assignmentsView: document.getElementById("assignmentsView"),
  classesView: document.getElementById("classesView"),
  submissionsView: document.getElementById("submissionsView"),
  calendarView: document.getElementById("calendarView"),
  analyticsView: document.getElementById("analyticsView"),
  settingsView: document.getElementById("settingsView"),

  // Dashboard Specific Elements
  dashGreeting: document.getElementById("dashGreeting"),
  dashUserName: document.getElementById("dashUserName"),
  dashRolePill: document.getElementById("dashRolePill"),
  dashRolePillText: document.getElementById("dashRolePillText"),
  dashSubtitle: document.getElementById("dashSubtitle"),
  dashHeroCtaBtn: document.getElementById("dashHeroCtaBtn"),
  dashHeroCtaText: document.getElementById("dashHeroCtaText"),
  dashMetricsRow: document.getElementById("dashMetricsRow"),
  dashMidLeftCard: document.getElementById("dashMidLeftCard"),
  dashMidRightCard: document.getElementById("dashMidRightCard"),
  dashBottomLeftCard: document.getElementById("dashBottomLeftCard"),
  dashBottomRightCard: document.getElementById("dashBottomRightCard"),
  dashFullWidthWrap: document.getElementById("dashFullWidthWrap"),

  // Classes Page Elements
  classesPageTitle: document.getElementById("classesPageTitle"),
  classesPageSubtitle: document.getElementById("classesPageSubtitle"),
  classesPageActionBtn: document.getElementById("classesPageActionBtn"),
  classesPageActionText: document.getElementById("classesPageActionText"),
  classesPageContent: document.getElementById("classesPageContent"),

  // Submissions Page Elements
  submissionsPageTitle: document.getElementById("submissionsPageTitle"),
  submissionsPageSubtitle: document.getElementById("submissionsPageSubtitle"),
  submissionsRefreshBtn: document.getElementById("submissionsRefreshBtn"),
  submissionsSearchInput: document.getElementById("submissionsSearchInput"),
  submissionsStatusFilter: document.getElementById("submissionsStatusFilter"),
  submissionsPageTable: document.getElementById("submissionsPageTable"),
  submissionsTableHead: document.getElementById("submissionsTableHead"),
  submissionsTableBody: document.getElementById("submissionsTableBody"),
  submissionsLoadingState: document.getElementById("submissionsLoadingState"),
  submissionsEmptyState: document.getElementById("submissionsEmptyState"),
  submissionsEmptyTitle: document.getElementById("submissionsEmptyTitle"),
  submissionsEmptyText: document.getElementById("submissionsEmptyText"),

  // Calendar Page Elements
  calendarViewAssignmentsBtn: document.getElementById("calendarViewAssignmentsBtn"),
  calendarDeadlinesList: document.getElementById("calendarDeadlinesList"),
  calendarMiniMonthContainer: document.getElementById("calendarMiniMonthContainer"),
  calendarCurrentMonthLabel: document.getElementById("calendarCurrentMonthLabel"),

  // Analytics Page Elements
  analyticsPageTitle: document.getElementById("analyticsPageTitle"),
  analyticsPageSubtitle: document.getElementById("analyticsPageSubtitle"),
  analyticsKpiRow: document.getElementById("analyticsKpiRow"),
  analyticsLeftCard: document.getElementById("analyticsLeftCard"),
  analyticsRightCard: document.getElementById("analyticsRightCard"),

  // Settings Page Elements
  settingsAvatar: document.getElementById("settingsAvatar"),
  settingsFullName: document.getElementById("settingsFullName"),
  settingsEmail: document.getElementById("settingsEmail"),
  settingsRoleBadge: document.getElementById("settingsRoleBadge"),
  settingsUserId: document.getElementById("settingsUserId"),
  settingsDefaultSort: document.getElementById("settingsDefaultSort"),
  settingsReminderToggle: document.getElementById("settingsReminderToggle"),
  settingsSavePreferencesBtn: document.getElementById("settingsSavePreferencesBtn"),
  settingsLogoutBtn: document.getElementById("settingsLogoutBtn"),
  settingsClearCacheBtn: document.getElementById("settingsClearCacheBtn"),

  // Authentication Modal
  authModalBackdrop: document.getElementById("authModalBackdrop"),
  closeAuthModalBtn: document.getElementById("closeAuthModalBtn"),
  tabSignIn: document.getElementById("tabSignIn"),
  tabRegister: document.getElementById("tabRegister"),
  authAlert: document.getElementById("authAlert"),
  signInForm: document.getElementById("signInForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  loginSpinner: document.getElementById("loginSpinner"),
  loginBtnText: document.getElementById("loginBtnText"),
  registerForm: document.getElementById("registerForm"),
  regFullName: document.getElementById("regFullName"),
  regEmail: document.getElementById("regEmail"),
  regPassword: document.getElementById("regPassword"),
  regSubmitBtn: document.getElementById("regSubmitBtn"),
  regSpinner: document.getElementById("regSpinner"),
  regBtnText: document.getElementById("regBtnText"),
  roleTeacherCard: document.getElementById("roleTeacherCard"),
  roleStudentCard: document.getElementById("roleStudentCard"),

  // Statistics
  statTotalCount: document.getElementById("statTotalCount"),
  statActiveCount: document.getElementById("statActiveCount"),
  statCompletedCount: document.getElementById("statCompletedCount"),
  statOverdueCount: document.getElementById("statOverdueCount"),

  // Toolbar & Filters
  tableSearchInput: document.getElementById("tableSearchInput"),
  subjectFilter: document.getElementById("subjectFilter"),
  statusFilter: document.getElementById("statusFilter"),
  sortFilter: document.getElementById("sortFilter"),

  // Table & States
  assignmentsTable: document.getElementById("assignmentsTable"),
  tableBody: document.getElementById("tableBody"),
  loadingState: document.getElementById("loadingState"),
  emptyState: document.getElementById("emptyState"),
  emptyStateText: document.getElementById("emptyStateText"),
  emptyStateCreateBtn: document.getElementById("emptyStateCreateBtn"),
  errorState: document.getElementById("errorState"),
  errorMessageText: document.getElementById("errorMessageText"),
  retryFetchBtn: document.getElementById("retryFetchBtn"),

  // Drawer / Form
  openCreateDrawerBtn: document.getElementById("openCreateDrawerBtn"),
  mobileFabBtn: document.getElementById("mobileFabBtn"),
  drawerOverlay: document.getElementById("drawerOverlay"),
  assignmentDrawer: document.getElementById("assignmentDrawer"),
  drawerTitle: document.getElementById("drawerTitle"),
  drawerCloseBtn: document.getElementById("drawerCloseBtn"),
  drawerCancelBtn: document.getElementById("drawerCancelBtn"),
  assignmentForm: document.getElementById("assignmentForm"),
  drawerSubmitBtn: document.getElementById("drawerSubmitBtn"),
  submitBtnText: document.getElementById("submitBtnText"),
  submitSpinner: document.getElementById("submitSpinner"),

  // Form Inputs
  assignmentId: document.getElementById("assignmentId"),
  formTitle: document.getElementById("formTitle"),
  formSubject: document.getElementById("formSubject"),
  formCustomSubject: document.getElementById("formCustomSubject"),
  customSubjectGroup: document.getElementById("customSubjectGroup"),
  formDescription: document.getElementById("formDescription"),
  formPdf: document.getElementById("formPdf"),
  fileDropzone: document.getElementById("fileDropzone"),
  dropzoneText: document.getElementById("dropzoneText"),
  currentAttachmentBox: document.getElementById("currentAttachmentBox"),
  currentAttachmentName: document.getElementById("currentAttachmentName"),
  pdfRequiredStar: document.getElementById("pdfRequiredStar"),
  pdfError: document.getElementById("pdfError"),
  formDueDate: document.getElementById("formDueDate"),
  formStatus: document.getElementById("formStatus"),
  titleError: document.getElementById("titleError"),
  subjectError: document.getElementById("subjectError"),
  dueDateError: document.getElementById("dueDateError"),

  // Delete Modal
  deleteModalBackdrop: document.getElementById("deleteModalBackdrop"),
  deleteAssignmentTitle: document.getElementById("deleteAssignmentTitle"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

  // Classes Management
  openClassesModalBtn: document.getElementById("openClassesModalBtn"),
  sidebarClassesLink: document.getElementById("sidebarClassesLink"),
  classesBtnText: document.getElementById("classesBtnText"),
  classesModalBackdrop: document.getElementById("classesModalBackdrop"),
  closeClassesModalBtn: document.getElementById("closeClassesModalBtn"),
  classesAlert: document.getElementById("classesAlert"),
  classesModalTitle: document.getElementById("classesModalTitle"),
  classesModalSubtitle: document.getElementById("classesModalSubtitle"),
  teacherClassesView: document.getElementById("teacherClassesView"),
  createClassForm: document.getElementById("createClassForm"),
  newClassName: document.getElementById("newClassName"),
  newClassDesc: document.getElementById("newClassDesc"),
  btnCreateClass: document.getElementById("btnCreateClass"),
  teacherClassesCount: document.getElementById("teacherClassesCount"),
  teacherClassesListContainer: document.getElementById("teacherClassesListContainer"),
  studentClassesView: document.getElementById("studentClassesView"),
  joinClassForm: document.getElementById("joinClassForm"),
  studentJoinCode: document.getElementById("studentJoinCode"),
  btnJoinClass: document.getElementById("btnJoinClass"),
  studentClassesCount: document.getElementById("studentClassesCount"),
  studentClassesListContainer: document.getElementById("studentClassesListContainer"),
  classStudentsView: document.getElementById("classStudentsView"),
  btnBackToClasses: document.getElementById("btnBackToClasses"),
  classStudentsTitle: document.getElementById("classStudentsTitle"),
  studentsTableContainer: document.getElementById("studentsTableContainer"),
  classFilter: document.getElementById("classFilter"),
  formClass: document.getElementById("formClass"),
  formClassGroup: document.getElementById("formClassGroup"),

  // Student Submissions Modals & Elements
  submitWorkModalBackdrop: document.getElementById("submitWorkModalBackdrop"),
  closeSubmitWorkModalBtn: document.getElementById("closeSubmitWorkModalBtn"),
  submitWorkAlert: document.getElementById("submitWorkAlert"),
  submitWorkForm: document.getElementById("submitWorkForm"),
  submitWorkAssignmentBanner: document.getElementById("submitWorkAssignmentBanner"),
  submitWorkAssignmentName: document.getElementById("submitWorkAssignmentName"),
  submitWorkCourseName: document.getElementById("submitWorkCourseName"),
  submitWorkDueDate: document.getElementById("submitWorkDueDate"),
  submissionFileInput: document.getElementById("submissionFileInput"),
  submissionDropzone: document.getElementById("submissionDropzone"),
  submissionDropzoneContent: document.getElementById("submissionDropzoneContent"),
  submissionFilePreview: document.getElementById("submissionFilePreview"),
  submissionFileName: document.getElementById("submissionFileName"),
  submissionFileSize: document.getElementById("submissionFileSize"),
  btnRemoveSubmissionFile: document.getElementById("btnRemoveSubmissionFile"),
  submissionFileError: document.getElementById("submissionFileError"),
  submissionNotes: document.getElementById("submissionNotes"),
  btnCancelSubmitWork: document.getElementById("btnCancelSubmitWork"),
  btnSubmitWork: document.getElementById("btnSubmitWork"),
  submitWorkSpinner: document.getElementById("submitWorkSpinner"),
  submitWorkBtnText: document.getElementById("submitWorkBtnText"),

  viewSubmissionModalBackdrop: document.getElementById("viewSubmissionModalBackdrop"),
  closeViewSubmissionModalBtn: document.getElementById("closeViewSubmissionModalBtn"),
  viewSubResultsCard: document.getElementById("viewSubResultsCard"),
  viewSubScoreVal: document.getElementById("viewSubScoreVal"),
  viewSubScoreMax: document.getElementById("viewSubScoreMax"),
  viewSubScorePct: document.getElementById("viewSubScorePct"),
  viewSubFeedbackBox: document.getElementById("viewSubFeedbackBox"),
  viewSubFeedbackText: document.getElementById("viewSubFeedbackText"),
  viewSubPendingBanner: document.getElementById("viewSubPendingBanner"),
  viewSubStatusPill: document.getElementById("viewSubStatusPill"),
  viewSubDate: document.getElementById("viewSubDate"),
  viewSubFileName: document.getElementById("viewSubFileName"),
  viewSubFileSize: document.getElementById("viewSubFileSize"),
  viewSubNotesBox: document.getElementById("viewSubNotesBox"),
  viewSubNotes: document.getElementById("viewSubNotes"),
  btnDownloadMySubmission: document.getElementById("btnDownloadMySubmission"),
  btnPreviewMySubmission: document.getElementById("btnPreviewMySubmission"),

  // Teacher Submissions Roster Modal Elements
  teacherSubmissionsModalBackdrop: document.getElementById("teacherSubmissionsModalBackdrop"),
  closeTeacherSubmissionsModalBtn: document.getElementById("closeTeacherSubmissionsModalBtn"),
  teacherSubmissionsAlert: document.getElementById("teacherSubmissionsAlert"),
  teacherSubmissionsAssignmentTitle: document.getElementById("teacherSubmissionsAssignmentTitle"),
  teacherSubmissionsCount: document.getElementById("teacherSubmissionsCount"),
  teacherSubmissionsTableContainer: document.getElementById("teacherSubmissionsTableContainer"),
  teacherSubmissionsTable: document.getElementById("teacherSubmissionsTable"),
  teacherSubmissionsTableBody: document.getElementById("teacherSubmissionsTableBody"),
  teacherSubmissionsEmptyState: document.getElementById("teacherSubmissionsEmptyState"),
  teacherReleaseAllBtn: document.getElementById("teacherReleaseAllBtn"),
  teacherReleaseAllCount: document.getElementById("teacherReleaseAllCount"),
  teacherExportCsvBtn: document.getElementById("teacherExportCsvBtn"),
  teacherDownloadZipBtn: document.getElementById("teacherDownloadZipBtn"),
  teacherSelectAllSubmissions: document.getElementById("teacherSelectAllSubmissions"),
  teacherSelectedCount: document.getElementById("teacherSelectedCount"),
  teacherSelectedCountBanner: document.getElementById("teacherSelectedCountBanner"),

  // Teacher Grading Workspace Elements (SpeedGrader)
  gradingWorkspaceModalBackdrop: document.getElementById("gradingWorkspaceModalBackdrop"),
  closeGradingWorkspaceBtn: document.getElementById("closeGradingWorkspaceBtn"),
  gradingWorkspaceAlert: document.getElementById("gradingWorkspaceAlert"),
  gradingWorkspaceTitle: document.getElementById("gradingWorkspaceTitle"),
  gradingWorkspaceSubtitle: document.getElementById("gradingWorkspaceSubtitle"),
  gradingPrevStudentBtn: document.getElementById("gradingPrevStudentBtn"),
  gradingNextStudentBtn: document.getElementById("gradingNextStudentBtn"),
  gradingStudentCounter: document.getElementById("gradingStudentCounter"),
  gradingPdfContainer: document.getElementById("gradingPdfContainer"),
  gradingPdfIframe: document.getElementById("gradingPdfIframe"),
  gradingPdfSpinner: document.getElementById("gradingPdfSpinner"),
  gradingDownloadBtn: document.getElementById("gradingDownloadBtn"),
  gradingNonPdfFallback: document.getElementById("gradingNonPdfFallback"),
  gradingNonPdfFilename: document.getElementById("gradingNonPdfFilename"),
  gradingNonPdfMeta: document.getElementById("gradingNonPdfMeta"),
  gradingNonPdfDownloadBtn: document.getElementById("gradingNonPdfDownloadBtn"),
  gradingStudentName: document.getElementById("gradingStudentName"),
  gradingStudentEmail: document.getElementById("gradingStudentEmail"),
  gradingLateBadge: document.getElementById("gradingLateBadge"),
  gradingSubmittedAt: document.getElementById("gradingSubmittedAt"),
  gradingStudentNotes: document.getElementById("gradingStudentNotes"),
  gradingStatusBadge: document.getElementById("gradingStatusBadge"),
  gradingMarksInput: document.getElementById("gradingMarksInput"),
  gradingMaxMarksLabel: document.getElementById("gradingMaxMarksLabel"),
  gradingMarksError: document.getElementById("gradingMarksError"),
  gradingFeedbackInput: document.getElementById("gradingFeedbackInput"),
  gradingSaveDraftBtn: document.getElementById("gradingSaveDraftBtn"),
  gradingSaveNextBtn: document.getElementById("gradingSaveNextBtn"),
  gradingReleaseSingleBtn: document.getElementById("gradingReleaseSingleBtn"),

  // Single Release Confirmation Modal
  singleReleaseConfirmBackdrop: document.getElementById("singleReleaseConfirmBackdrop"),
  closeSingleReleaseConfirmBtn: document.getElementById("closeSingleReleaseConfirmBtn"),
  cancelSingleReleaseBtn: document.getElementById("cancelSingleReleaseBtn"),
  confirmSingleReleaseBtn: document.getElementById("confirmSingleReleaseBtn"),
  singleReleaseConfirmMessage: document.getElementById("singleReleaseConfirmMessage"),

  // Bulk Release Confirmation Modal
  bulkReleaseConfirmBackdrop: document.getElementById("bulkReleaseConfirmBackdrop"),
  closeBulkReleaseConfirmBtn: document.getElementById("closeBulkReleaseConfirmBtn"),
  cancelBulkReleaseBtn: document.getElementById("cancelBulkReleaseBtn"),
  confirmBulkReleaseBtn: document.getElementById("confirmBulkReleaseBtn"),
  bulkReleaseConfirmMessage: document.getElementById("bulkReleaseConfirmMessage"),

  // Dedicated Submission Document Preview Modal
  submissionPreviewModalBackdrop: document.getElementById("submissionPreviewModalBackdrop"),
  closeSubmissionPreviewModalBtn: document.getElementById("closeSubmissionPreviewModalBtn"),
  submissionPreviewModalTitle: document.getElementById("submissionPreviewModalTitle"),
  submissionPreviewSubtitle: document.getElementById("submissionPreviewSubtitle"),
  submissionPreviewDownloadTopBtn: document.getElementById("submissionPreviewDownloadTopBtn"),
  submissionPreviewAlert: document.getElementById("submissionPreviewAlert"),
  submissionPreviewSpinner: document.getElementById("submissionPreviewSpinner"),
  submissionPreviewContainer: document.getElementById("submissionPreviewContainer"),
  submissionPreviewIframe: document.getElementById("submissionPreviewIframe"),
  submissionPreviewFallback: document.getElementById("submissionPreviewFallback"),
  submissionPreviewFallbackFilename: document.getElementById("submissionPreviewFallbackFilename"),
  submissionPreviewFallbackMeta: document.getElementById("submissionPreviewFallbackMeta"),
  submissionPreviewFallbackDownloadBtn: document.getElementById("submissionPreviewFallbackDownloadBtn"),

  // Toasts
  toastContainer: document.getElementById("toastContainer"),
};

// ==========================================================================
// Initialization
// ==========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await checkCurrentUser();
});

// ==========================================================================
// Event Listeners Setup
// ==========================================================================

function setupEventListeners() {
  // Window Hashchange listener for direct navigation, refresh & browser back/forward
  window.addEventListener("hashchange", () => {
    const rawHash = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase();
    const route = rawHash || "dashboard";
    navigateToView(route, false);
  });

  // Nav item click interaction
  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-nav");
      if (target) {
        navigateToView(target, true);
      }
      closeSidebar();
    });
  });

  // Sidebar Sign Out button
  if (elements.sidebarSignOutBtn) {
    elements.sidebarSignOutBtn.addEventListener("click", () => {
      handleLogout();
    });
  }

  // Dashboard Hero CTA Button
  if (elements.dashHeroCtaBtn) {
    elements.dashHeroCtaBtn.addEventListener("click", () => {
      if (state.currentUser && state.currentUser.role === "teacher") {
        openDrawer();
      } else {
        openClassesModal();
      }
    });
  }

  // Top Search & Table Search Synchronization
  elements.globalSearchInput.addEventListener("input", (e) => {
    elements.tableSearchInput.value = e.target.value;
    state.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  elements.tableSearchInput.addEventListener("input", (e) => {
    elements.globalSearchInput.value = e.target.value;
    state.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  // Filters
  if (elements.classFilter) {
    elements.classFilter.addEventListener("change", (e) => {
      state.filters.classId = e.target.value;
      applyFiltersAndRender();
    });
  }

  elements.subjectFilter.addEventListener("change", (e) => {
    state.filters.subject = e.target.value;
    applyFiltersAndRender();
  });

  elements.statusFilter.addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    applyFiltersAndRender();
  });

  elements.sortFilter.addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    applyFiltersAndRender();
  });

  // Drawer Open / Close
  elements.openCreateDrawerBtn.addEventListener("click", () => openDrawer());
  if (elements.mobileFabBtn) {
    elements.mobileFabBtn.addEventListener("click", () => openDrawer());
  }
  elements.emptyStateCreateBtn.addEventListener("click", () => openDrawer());
  elements.drawerCloseBtn.addEventListener("click", closeDrawer);
  elements.drawerCancelBtn.addEventListener("click", closeDrawer);
  elements.drawerOverlay.addEventListener("click", closeDrawer);

  // Subject "Other" toggle
  elements.formSubject.addEventListener("change", (e) => {
    if (e.target.value === "Other") {
      elements.customSubjectGroup.style.display = "flex";
      elements.formCustomSubject.focus();
    } else {
      elements.customSubjectGroup.style.display = "none";
      elements.formCustomSubject.value = "";
    }
  });

  // Form Submit
  elements.assignmentForm.addEventListener("submit", handleFormSubmit);

  // File Dropzone & Input Handlers
  if (elements.fileDropzone && elements.formPdf) {
    elements.fileDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.add("dragover");
    });

    elements.fileDropzone.addEventListener("dragleave", () => {
      elements.fileDropzone.classList.remove("dragover");
    });

    elements.fileDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      elements.fileDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        elements.formPdf.files = e.dataTransfer.files;
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    elements.formPdf.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelection(e.target.files[0]);
      } else {
        resetDropzoneText();
      }
    });
  }

  // Delete Modal
  elements.cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  elements.deleteModalBackdrop.addEventListener("click", (e) => {
    if (e.target === elements.deleteModalBackdrop) closeDeleteModal();
  });
  elements.confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

  // Error State Retry
  elements.retryFetchBtn.addEventListener("click", fetchAssignments);

  // Top Bar Actions
  elements.notificationBtn.addEventListener("click", () => {
    showToast("You have 1 reminder: Check upcoming assignment deadlines.", "info");
  });

  // Profile dropdown toggle
  elements.profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileMenu();
  });

  // Close profile dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (elements.profileDropdownWrapper && !elements.profileDropdownWrapper.contains(e.target)) {
      closeProfileMenu();
    }
  });

  // Profile Menu actions
  if (elements.menuSwitchAccountBtn) {
    elements.menuSwitchAccountBtn.addEventListener("click", () => {
      closeProfileMenu();
      openAuthModal("signin");
    });
  }

  if (elements.menuLogoutBtn) {
    elements.menuLogoutBtn.addEventListener("click", () => {
      handleLogout();
    });
  }

  // Auth Modal Tab switching
  if (elements.tabSignIn && elements.tabRegister) {
    elements.tabSignIn.addEventListener("click", () => switchAuthMode("signin"));
    elements.tabRegister.addEventListener("click", () => switchAuthMode("register"));
  }

  // Role Selection Cards
  if (elements.roleTeacherCard && elements.roleStudentCard) {
    elements.roleTeacherCard.addEventListener("click", () => {
      elements.roleTeacherCard.classList.add("active");
      elements.roleStudentCard.classList.remove("active");
      const radio = elements.roleTeacherCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });

    elements.roleStudentCard.addEventListener("click", () => {
      elements.roleStudentCard.classList.add("active");
      elements.roleTeacherCard.classList.remove("active");
      const radio = elements.roleStudentCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  }

  // Auth Forms Submission
  if (elements.signInForm) {
    elements.signInForm.addEventListener("submit", handleLoginSubmit);
  }
  if (elements.registerForm) {
    elements.registerForm.addEventListener("submit", handleRegisterSubmit);
  }

  // Auth Modal Backdrop & Close Button
  if (elements.closeAuthModalBtn) {
    elements.closeAuthModalBtn.addEventListener("click", () => {
      closeAuthModal();
    });
  }

  if (elements.authModalBackdrop) {
    elements.authModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.authModalBackdrop && state.currentUser) {
        closeAuthModal();
      }
    });
  }

  // Classes Management Listeners
  if (elements.openClassesModalBtn) {
    elements.openClassesModalBtn.addEventListener("click", () => openClassesModal());
  }

  if (elements.sidebarClassesLink) {
    elements.sidebarClassesLink.addEventListener("click", (e) => {
      e.preventDefault();
      elements.navLinks.forEach((l) => l.classList.remove("active"));
      elements.sidebarClassesLink.classList.add("active");
      openClassesModal();
      closeSidebar();
    });
  }

  if (elements.closeClassesModalBtn) {
    elements.closeClassesModalBtn.addEventListener("click", closeClassesModal);
  }

  if (elements.classesModalBackdrop) {
    elements.classesModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.classesModalBackdrop) {
        closeClassesModal();
      }
    });
  }

  if (elements.createClassForm) {
    elements.createClassForm.addEventListener("submit", handleCreateClassSubmit);
  }

  if (elements.joinClassForm) {
    elements.joinClassForm.addEventListener("submit", handleJoinClassSubmit);
  }

  if (elements.btnBackToClasses) {
    elements.btnBackToClasses.addEventListener("click", showTeacherClassesMainView);
  }

  // Student Submission Modal Listeners
  if (elements.closeSubmitWorkModalBtn) {
    elements.closeSubmitWorkModalBtn.addEventListener("click", closeSubmitWorkModal);
  }
  if (elements.btnCancelSubmitWork) {
    elements.btnCancelSubmitWork.addEventListener("click", closeSubmitWorkModal);
  }
  if (elements.submitWorkModalBackdrop) {
    elements.submitWorkModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.submitWorkModalBackdrop) closeSubmitWorkModal();
    });
  }
  if (elements.submitWorkForm) {
    elements.submitWorkForm.addEventListener("submit", handleSubmitWorkForm);
  }
  if (elements.btnRemoveSubmissionFile) {
    elements.btnRemoveSubmissionFile.addEventListener("click", resetSubmissionDropzone);
  }

  // Submission Dropzone Drag-and-Drop
  if (elements.submissionDropzone && elements.submissionFileInput) {
    elements.submissionDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      elements.submissionDropzone.classList.add("dragover");
    });
    elements.submissionDropzone.addEventListener("dragleave", () => {
      elements.submissionDropzone.classList.remove("dragover");
    });
    elements.submissionDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      elements.submissionDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        elements.submissionFileInput.files = e.dataTransfer.files;
        handleSubmissionFileSelection(e.dataTransfer.files[0]);
      }
    });
    elements.submissionFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSubmissionFileSelection(e.target.files[0]);
      } else {
        resetSubmissionDropzone();
      }
    });
  }

  // View Submission Modal Listeners
  if (elements.closeViewSubmissionModalBtn) {
    elements.closeViewSubmissionModalBtn.addEventListener("click", closeViewSubmissionModal);
  }
  if (elements.viewSubmissionModalBackdrop) {
    elements.viewSubmissionModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.viewSubmissionModalBackdrop) closeViewSubmissionModal();
    });
  }

  // Teacher Submissions Modal Listeners
  if (elements.closeTeacherSubmissionsModalBtn) {
    elements.closeTeacherSubmissionsModalBtn.addEventListener("click", closeTeacherSubmissionsModal);
  }
  if (elements.teacherSubmissionsModalBackdrop) {
    elements.teacherSubmissionsModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.teacherSubmissionsModalBackdrop) closeTeacherSubmissionsModal();
    });
  }
  if (elements.teacherReleaseAllBtn) {
    elements.teacherReleaseAllBtn.addEventListener("click", openBulkReleaseModal);
  }
  if (elements.teacherExportCsvBtn) {
    elements.teacherExportCsvBtn.addEventListener("click", handleExportCsv);
  }
  if (elements.teacherDownloadZipBtn) {
    elements.teacherDownloadZipBtn.addEventListener("click", handleDownloadZip);
  }
  if (elements.teacherSelectAllSubmissions) {
    elements.teacherSelectAllSubmissions.addEventListener("change", handleToggleSelectAllSubmissions);
  }

  // Teacher Grading Workspace Listeners
  if (elements.closeGradingWorkspaceBtn) {
    elements.closeGradingWorkspaceBtn.addEventListener("click", closeGradingWorkspaceModal);
  }
  if (elements.gradingWorkspaceModalBackdrop) {
    elements.gradingWorkspaceModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.gradingWorkspaceModalBackdrop) closeGradingWorkspaceModal();
    });
  }
  if (elements.gradingPrevStudentBtn) {
    elements.gradingPrevStudentBtn.addEventListener("click", () => navigateGradingWorkspace(-1));
  }
  if (elements.gradingNextStudentBtn) {
    elements.gradingNextStudentBtn.addEventListener("click", () => navigateGradingWorkspace(1));
  }
  if (elements.gradingSaveDraftBtn) {
    elements.gradingSaveDraftBtn.addEventListener("click", () => saveGrade(false));
  }
  if (elements.gradingSaveNextBtn) {
    elements.gradingSaveNextBtn.addEventListener("click", () => saveGrade(true));
  }
  if (elements.gradingReleaseSingleBtn) {
    elements.gradingReleaseSingleBtn.addEventListener("click", () => confirmSingleRelease());
  }

  // Single Release Confirmation Modal Listeners
  if (elements.closeSingleReleaseConfirmBtn) {
    elements.closeSingleReleaseConfirmBtn.addEventListener("click", closeSingleReleaseModal);
  }
  if (elements.cancelSingleReleaseBtn) {
    elements.cancelSingleReleaseBtn.addEventListener("click", closeSingleReleaseModal);
  }
  if (elements.confirmSingleReleaseBtn) {
    elements.confirmSingleReleaseBtn.addEventListener("click", () => confirmSingleRelease());
  }
  if (elements.singleReleaseConfirmBackdrop) {
    elements.singleReleaseConfirmBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.singleReleaseConfirmBackdrop) closeSingleReleaseModal();
    });
  }

  // Bulk Release Confirmation Modal Listeners
  if (elements.closeBulkReleaseConfirmBtn) {
    elements.closeBulkReleaseConfirmBtn.addEventListener("click", closeBulkReleaseModal);
  }
  if (elements.cancelBulkReleaseBtn) {
    elements.cancelBulkReleaseBtn.addEventListener("click", closeBulkReleaseModal);
  }
  if (elements.confirmBulkReleaseBtn) {
    elements.confirmBulkReleaseBtn.addEventListener("click", confirmBulkRelease);
  }
  if (elements.bulkReleaseConfirmBackdrop) {
    elements.bulkReleaseConfirmBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.bulkReleaseConfirmBackdrop) closeBulkReleaseModal();
    });
  }

  // Submission Document Preview Modal Listeners
  if (elements.closeSubmissionPreviewModalBtn) {
    elements.closeSubmissionPreviewModalBtn.addEventListener("click", closeSubmissionPreviewModal);
  }
  if (elements.submissionPreviewModalBackdrop) {
    elements.submissionPreviewModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.submissionPreviewModalBackdrop) closeSubmissionPreviewModal();
    });
  }

  // Keyboard navigation shortcuts
  document.addEventListener("keydown", (e) => {
    // If submission preview modal is open, handle Escape
    if (elements.submissionPreviewModalBackdrop && elements.submissionPreviewModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSubmissionPreviewModal();
        return;
      }
    }
    // If confirmation modals are open, handle Escape
    if (elements.singleReleaseConfirmBackdrop && elements.singleReleaseConfirmBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSingleReleaseModal();
        return;
      }
    }
    if (elements.bulkReleaseConfirmBackdrop && elements.bulkReleaseConfirmBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeBulkReleaseModal();
        return;
      }
    }
    // If grading workspace modal is open
    if (elements.gradingWorkspaceModalBackdrop && elements.gradingWorkspaceModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeGradingWorkspaceModal();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        navigateGradingWorkspace(-1);
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        navigateGradingWorkspace(1);
      }
    }
  });

  // Classes Page Action Button
  if (elements.classesPageActionBtn) {
    elements.classesPageActionBtn.addEventListener("click", () => {
      openClassesModal();
    });
  }

  // Submissions Page Refresh & Filters
  if (elements.submissionsRefreshBtn) {
    elements.submissionsRefreshBtn.addEventListener("click", () => {
      loadSubmissionsPageView();
    });
  }
  if (elements.submissionsSearchInput) {
    elements.submissionsSearchInput.addEventListener("input", filterAndRenderSubmissions);
  }
  if (elements.submissionsStatusFilter) {
    elements.submissionsStatusFilter.addEventListener("change", filterAndRenderSubmissions);
  }

  // Calendar View "Go to Assignments"
  if (elements.calendarViewAssignmentsBtn) {
    elements.calendarViewAssignmentsBtn.addEventListener("click", () => {
      navigateToView("assignments", true);
    });
  }

  // Settings Page Action Buttons
  if (elements.settingsSavePreferencesBtn) {
    elements.settingsSavePreferencesBtn.addEventListener("click", saveSettingsPreferences);
  }
  if (elements.settingsLogoutBtn) {
    elements.settingsLogoutBtn.addEventListener("click", () => {
      handleLogout();
    });
  }
  if (elements.settingsClearCacheBtn) {
    elements.settingsClearCacheBtn.addEventListener("click", clearSettingsPreferences);
  }

  // Keyboard Shortcuts (ESC to close modals/drawers)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDrawer();
      closeDeleteModal();
      closeSidebar();
      closeProfileMenu();
      closeClassesModal();
      closeSubmitWorkModal();
      closeViewSubmissionModal();
      closeTeacherSubmissionsModal();
      if (state.currentUser) {
        closeAuthModal();
      }
    }
  });
}

// ==========================================================================
// API Interaction Functions
// ==========================================================================

/**
 * Fetches all assignments from the PostgreSQL database via FastAPI
 */
async function fetchAssignments() {
  showLoadingState();

  try {
    const response = await fetch(API_ENDPOINTS.assignments, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      state.currentUser = null;
      updateUserUI(null);
      openAuthModal("signin", "Please sign in to view your assignments.");
      return;
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    state.assignments = data;

    if (state.currentUser && state.currentUser.role === "student") {
      await fetchStudentSubmissions(data);
    }

    updateSubjectFilterOptions(data);
    populateClassFilterOptions(state.classes);
    updateStatistics(data);
    applyFiltersAndRender();
  } catch (error) {
    console.error("Error fetching assignments:", error);
    showErrorState(error.message || "Failed to load data from backend server.");
  }
}

/**
 * Submits assignment creation or update
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (state.currentUser && state.currentUser.role !== "teacher") {
    showToast("Permission denied: Only teachers can create or edit assignments.", "error");
    return;
  }

  if (!validateForm()) {
    return;
  }

  setFormLoading(true);

  // Determine Subject
  let subjectValue = elements.formSubject.value;
  if (subjectValue === "Other") {
    subjectValue = elements.formCustomSubject.value.trim() || "General";
  }

  // Format Due Date to ISO String
  const rawDate = elements.formDueDate.value;
  const isoDueDate = new Date(rawDate).toISOString();

  const isEditing = Boolean(state.editingId);
  const endpoint = isEditing
    ? `${API_ENDPOINTS.assignments}/${state.editingId}`
    : API_ENDPOINTS.assignments;
  const method = isEditing ? "PUT" : "POST";

  // Build FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append("title", elements.formTitle.value.trim());
  formData.append("subject", subjectValue);
  const descVal = elements.formDescription.value.trim();
  if (descVal) {
    formData.append("description", descVal);
  }
  formData.append("due_date", isoDueDate);
  formData.append("status", elements.formStatus.value);

  // Link to Class
  const classVal = elements.formClass ? elements.formClass.value : "";
  if (classVal) {
    formData.append("class_id", classVal);
  } else if (isEditing) {
    formData.append("class_id", "null");
  }

  // Attach PDF if selected
  if (elements.formPdf.files && elements.formPdf.files[0]) {
    formData.append("file", elements.formPdf.files[0]);
  }

  try {
    const response = await fetch(endpoint, {
      method: method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });

    if (response.status === 401) {
      state.currentUser = null;
      updateUserUI(null);
      openAuthModal("signin", "Session expired. Please sign in again.");
      return;
    }

    if (response.status === 403) {
      throw new Error("Permission denied: Only teachers can create or update assignments.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let detail = errorData.detail || `HTTP ${response.status}`;
      if (typeof detail !== "string") {
        if (Array.isArray(detail)) {
          detail = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          detail = JSON.stringify(detail);
        }
      }
      throw new Error(detail);
    }

    const savedAssignment = await response.json();

    closeDrawer();
    showToast(
      isEditing
        ? `Assignment "${savedAssignment.title}" updated successfully!`
        : `Assignment "${savedAssignment.title}" created successfully!`,
      "success"
    );

    // Refresh assignments list and classes from database
    await fetchAssignments();
    await fetchClasses();
  } catch (error) {
    console.error("Save error:", error);
    showToast(`Error: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
  }
}

/**
 * Deletes the pending assignment after confirmation
 */
async function handleConfirmDelete() {
  if (!state.deletePendingId) return;

  if (state.currentUser && state.currentUser.role !== "teacher") {
    showToast("Permission denied: Only teachers can delete assignments.", "error");
    closeDeleteModal();
    return;
  }

  const id = state.deletePendingId;
  elements.confirmDeleteBtn.disabled = true;
  elements.confirmDeleteBtn.textContent = "Deleting...";

  try {
    const response = await fetch(`${API_ENDPOINTS.assignments}/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      state.currentUser = null;
      updateUserUI(null);
      openAuthModal("signin", "Session expired. Please sign in again.");
      return;
    }

    if (response.status === 403) {
      throw new Error("Permission denied: Only teachers can delete assignments.");
    }

    if (!response.ok) {
      throw new Error(`Failed to delete (HTTP ${response.status})`);
    }

    closeDeleteModal();
    showToast("Assignment deleted successfully.", "success");
    await fetchAssignments();
    await fetchClasses();
  } catch (error) {
    console.error("Delete error:", error);
    showToast(`Failed to delete: ${error.message}`, "error");
  } finally {
    elements.confirmDeleteBtn.disabled = false;
    elements.confirmDeleteBtn.textContent = "Delete";
  }
}

// ==========================================================================
// Status & Overdue Calculations
// ==========================================================================

/**
 * Documented Status Calculation Rules:
 * 1. Completed:
 *    - assignment.status === "completed" || assignment.status === "closed"
 * 2. Overdue:
 *    - NOT completed (neither completed nor closed)
 *    - AND (new Date(due_date) < current_time OR assignment.status === "overdue")
 * 3. Draft:
 *    - NOT completed and NOT overdue
 *    - AND assignment.status === "draft"
 * 4. Active:
 *    - NOT completed and NOT overdue
 *    - AND assignment.status === "active" (default)
 */
function getEffectiveStatus(assignment) {
  // Rule 1: Completion status takes precedence (completed assignments are never overdue)
  const isCompleted = assignment.status === "completed" || assignment.status === "closed";
  if (isCompleted) {
    return "completed";
  }

  // Rule 2: Overdue calculation from due date and non-completed state
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  const isPastDue = !isNaN(dueDate.getTime()) && dueDate < now;

  if (isPastDue || assignment.status === "overdue") {
    return "overdue";
  }

  // Rule 3: Draft status (not overdue, not completed)
  if (assignment.status === "draft") {
    return "draft";
  }

  // Rule 4: Active status
  return "active";
}

/**
 * Updates the 4 statistics summary cards dynamically
 */
function updateStatistics(assignments) {
  const total = assignments.length;
  let activeCount = 0;
  let completedCount = 0;
  let overdueCount = 0;

  assignments.forEach((assignment) => {
    const status = getEffectiveStatus(assignment);
    if (status === "active") activeCount++;
    else if (status === "completed") completedCount++;
    else if (status === "overdue") overdueCount++;
  });

  elements.statTotalCount.textContent = total;
  elements.statActiveCount.textContent = activeCount;
  elements.statCompletedCount.textContent = completedCount;
  elements.statOverdueCount.textContent = overdueCount;
}

// ==========================================================================
// Filter, Search, and Sort Engine
// ==========================================================================

function applyFiltersAndRender() {
  const { search, subject, status, sort } = state.filters;

  let filtered = [...state.assignments];

  // 1. Text Search (title, subject, description)
  if (search) {
    filtered = filtered.filter((item) => {
      const title = (item.title || "").toLowerCase();
      const subj = (item.subject || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      return title.includes(search) || subj.includes(search) || desc.includes(search);
    });
  }

  // 2. Class Filter
  if (state.filters.classId && state.filters.classId !== "all") {
    if (state.filters.classId === "unassigned") {
      filtered = filtered.filter((item) => !item.class_id);
    } else {
      const targetCid = parseInt(state.filters.classId, 10);
      filtered = filtered.filter((item) => item.class_id === targetCid);
    }
  }

  // 3. Subject Filter
  if (subject !== "all") {
    filtered = filtered.filter((item) => item.subject === subject);
  }

  // 4. Status Filter
  if (status !== "all") {
    filtered = filtered.filter((item) => {
      const effectiveStatus = getEffectiveStatus(item);
      return effectiveStatus === status;
    });
  }

  // 4. Sorting
  filtered.sort((a, b) => {
    if (sort === "newest") {
      return (b.id || 0) - (a.id || 0);
    } else if (sort === "oldest") {
      return (a.id || 0) - (b.id || 0);
    } else if (sort === "due_soon") {
      return new Date(a.due_date) - new Date(b.due_date);
    } else if (sort === "title_asc") {
      return (a.title || "").localeCompare(b.title || "");
    }
    return 0;
  });

  state.filteredAssignments = filtered;
  renderTable(filtered);
}

// ==========================================================================
// Table Rendering
// ==========================================================================

function renderTable(assignments) {
  hideAllStates();

  const isTeacher = state.currentUser && state.currentUser.role === "teacher";
  const isStudent = state.currentUser && state.currentUser.role === "student";

  if (assignments.length === 0) {
    elements.assignmentsTable.style.display = "none";
    elements.emptyState.style.display = "flex";

    if (elements.emptyStateCreateBtn) {
      elements.emptyStateCreateBtn.style.display = isTeacher ? "inline-flex" : "none";
    }

    if (state.assignments.length === 0) {
      elements.emptyStateText.textContent = isTeacher
        ? "No assignments in the database yet. Click below to create your first assignment."
        : "No assignments are currently available.";
    } else {
      elements.emptyStateText.textContent = "No assignments match your active search or filters. Try adjusting your filters.";
    }
    return;
  }

  elements.emptyState.style.display = "none";
  elements.assignmentsTable.style.display = "table";

  elements.tableBody.innerHTML = "";

  assignments.forEach((assignment, index) => {
    const tr = document.createElement("tr");

    const effectiveStatus = getEffectiveStatus(assignment);
    const formattedDate = formatDisplayDate(assignment.due_date);
    const mySub = isStudent ? state.mySubmissions[assignment.id] : null;

    // Class pill badge
    const classBadge = assignment.class_name
      ? `<span class="class-pill" title="Class: ${escapeHtml(assignment.class_name)}">${escapeHtml(assignment.class_name)}</span>`
      : "";

    // PDF attachment chip indicator
    const pdfBadge = assignment.has_attachment
      ? `<a href="${API_BASE}/api/assignments/${assignment.id}/download" target="_blank" rel="noopener" class="pdf-chip" title="Download question sheet: ${escapeHtml(assignment.file_name || 'PDF')}">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
             <polyline points="14 2 14 8 20 8"></polyline>
             <line x1="12" y1="18" x2="12" y2="12"></line>
             <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
           PDF
         </a>`
      : "";

    // Action button for download if attachment exists
    const downloadActionBtn = assignment.has_attachment
      ? `<a href="${API_BASE}/api/assignments/${assignment.id}/download" target="_blank" rel="noopener" class="table-action-btn download-btn" data-id="${assignment.id}" aria-label="Download Question PDF" title="Download Question PDF (${escapeHtml(assignment.file_name || 'PDF')})">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
             <polyline points="7 10 12 15 17 10"></polyline>
             <line x1="12" y1="15" x2="12" y2="3"></line>
           </svg>
         </a>`
      : "";

    let actionsHtml = "";
    if (isTeacher) {
      actionsHtml = `
        <div class="action-btn-group">
          <button class="table-action-btn submissions-btn" data-id="${assignment.id}" aria-label="View Submissions" title="View Student Submissions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>
          ${downloadActionBtn}
          <button class="table-action-btn edit-btn" data-id="${assignment.id}" aria-label="Edit assignment" title="Edit Assignment">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              <path d="m15 5 4 4"></path>
            </svg>
          </button>
          <button class="table-action-btn delete-btn" data-id="${assignment.id}" aria-label="Delete assignment" title="Delete Assignment">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    } else if (isStudent) {
      if (mySub) {
        actionsHtml = `
          <div class="action-btn-group">
            ${downloadActionBtn}
            <button class="btn btn-sm btn-outline view-submission-btn" data-id="${assignment.id}" title="View Your Submission" style="padding: 0.25rem 0.65rem; font-size: 0.775rem;">
              View Work
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <div class="action-btn-group">
            ${downloadActionBtn}
            <button class="btn btn-sm btn-primary submit-work-btn" data-id="${assignment.id}" title="Submit Your Work" style="padding: 0.25rem 0.65rem; font-size: 0.775rem;">
              Submit Work
            </button>
          </div>
        `;
      }
    } else {
      actionsHtml = downloadActionBtn
        ? `<div class="action-btn-group">${downloadActionBtn}</div>`
        : `<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>`;
    }

    let studentSubBadge = "";
    if (isStudent && mySub) {
      if (mySub.status === "released" && mySub.grade !== null && mySub.grade !== undefined) {
        studentSubBadge = `<span class="submission-pill status-released" title="Grade Released: ${mySub.grade}/${mySub.max_marks || 100}">Score: ${mySub.grade}/${mySub.max_marks || 100}</span>`;
      } else {
        studentSubBadge = mySub.is_late
          ? `<span class="submission-pill status-late" title="Submitted Late on ${formatDisplayDate(mySub.submitted_at)}">✓ Late (In Review)</span>`
          : `<span class="submission-pill status-ungraded" title="Submitted on ${formatDisplayDate(mySub.submitted_at)}">✓ Pending Review</span>`;
      }
    }

    tr.innerHTML = `
      <td class="col-num">${index + 1}</td>
      <td class="col-title" title="${escapeHtml(assignment.description || assignment.title)}">
        <span class="title-text">${escapeHtml(assignment.title)}</span>
        ${pdfBadge}
      </td>
      <td class="col-subject">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
          <span>${escapeHtml(assignment.subject)}</span>
          ${classBadge}
        </div>
      </td>
      <td class="col-due">${formattedDate}</td>
      <td class="col-status">
        <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start;">
          <span class="status-pill status-${effectiveStatus}">
            ${capitalize(effectiveStatus)}
          </span>
          ${studentSubBadge}
        </div>
      </td>
      <td class="col-actions">
        ${actionsHtml}
      </td>
    `;

    // Attach row button events
    const editBtn = tr.querySelector(".edit-btn");
    const deleteBtn = tr.querySelector(".delete-btn");
    const submissionsBtn = tr.querySelector(".submissions-btn");
    const submitWorkBtn = tr.querySelector(".submit-work-btn");
    const viewSubBtn = tr.querySelector(".view-submission-btn");
    const subPill = tr.querySelector(".submission-pill");

    if (editBtn) {
      editBtn.addEventListener("click", () => openDrawer(assignment));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => openDeleteModal(assignment));
    }
    if (submissionsBtn) {
      submissionsBtn.addEventListener("click", () => openTeacherSubmissionsModal(assignment));
    }
    if (submitWorkBtn) {
      submitWorkBtn.addEventListener("click", () => openSubmitWorkModal(assignment));
    }
    if (viewSubBtn) {
      viewSubBtn.addEventListener("click", () => openViewSubmissionModal(assignment, mySub));
    }
    if (subPill && isStudent) {
      subPill.addEventListener("click", () => openViewSubmissionModal(assignment, mySub));
    }

    elements.tableBody.appendChild(tr);
  });
}

// ==========================================================================
// Drawer & Modal Controls
// ==========================================================================

function openDrawer(assignmentToEdit = null) {
  clearFormErrors();

  if (assignmentToEdit) {
    state.editingId = assignmentToEdit.id;
    elements.drawerTitle.textContent = "Edit Assignment";
    elements.submitBtnText.textContent = "Save Changes";

    elements.assignmentId.value = assignmentToEdit.id;
    elements.formTitle.value = assignmentToEdit.title || "";

    // Set Subject
    const knownSubjects = ["Computer Science", "Mathematics", "Science", "Design"];
    if (knownSubjects.includes(assignmentToEdit.subject)) {
      elements.formSubject.value = assignmentToEdit.subject;
      elements.customSubjectGroup.style.display = "none";
      elements.formCustomSubject.value = "";
    } else {
      elements.formSubject.value = "Other";
      elements.customSubjectGroup.style.display = "flex";
      elements.formCustomSubject.value = assignmentToEdit.subject || "";
    }

    elements.formDescription.value = assignmentToEdit.description || "";
    elements.formDueDate.value = formatInputDate(assignmentToEdit.due_date);
    elements.formStatus.value = assignmentToEdit.status || "active";
    if (elements.formClass) {
      elements.formClass.value = assignmentToEdit.class_id ? String(assignmentToEdit.class_id) : "";
    }

    // Reset file input for edit mode
    elements.formPdf.value = "";
    elements.dropzoneText.textContent = "Choose new PDF to replace (optional)";

    // Display existing attachment details if attached
    if (assignmentToEdit.has_attachment && assignmentToEdit.file_name) {
      elements.currentAttachmentBox.style.display = "flex";
      elements.currentAttachmentName.textContent = `${assignmentToEdit.file_name} (${formatBytes(assignmentToEdit.file_size || 0)})`;
      elements.pdfRequiredStar.style.display = "none";
    } else {
      elements.currentAttachmentBox.style.display = "none";
      elements.pdfRequiredStar.style.display = "inline";
    }
  } else {
    state.editingId = null;
    elements.drawerTitle.textContent = "Create New Assignment";
    elements.submitBtnText.textContent = "Create Assignment";

    elements.assignmentForm.reset();
    elements.assignmentId.value = "";
    elements.formPdf.value = "";
    elements.dropzoneText.textContent = "Choose question PDF or drag & drop";
    elements.currentAttachmentBox.style.display = "none";
    elements.pdfRequiredStar.style.display = "inline";
    elements.customSubjectGroup.style.display = "none";

    // Default due date to 7 days in the future
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    defaultDate.setHours(23, 59, 0, 0);
    elements.formDueDate.value = formatInputDate(defaultDate);
    elements.formStatus.value = "active";
    if (elements.formClass) {
      elements.formClass.value = "";
    }
  }

  elements.drawerOverlay.classList.add("active");
  elements.assignmentDrawer.classList.add("active");
  document.body.style.overflow = "hidden";

  setTimeout(() => elements.formTitle.focus(), 250);
}

function closeDrawer() {
  elements.drawerOverlay.classList.remove("active");
  elements.assignmentDrawer.classList.remove("active");
  document.body.style.overflow = "";
  state.editingId = null;
  clearFormErrors();
}

function openDeleteModal(assignment) {
  state.deletePendingId = assignment.id;
  elements.deleteAssignmentTitle.textContent = `"${assignment.title}"`;
  elements.deleteModalBackdrop.style.display = "flex";
}

function closeDeleteModal() {
  state.deletePendingId = null;
  elements.deleteModalBackdrop.style.display = "none";
}

function openSidebar() {
  elements.sidebar.classList.add("mobile-open");
  elements.sidebarBackdrop.classList.add("active");
}

function closeSidebar() {
  elements.sidebar.classList.remove("mobile-open");
  elements.sidebarBackdrop.classList.remove("active");
}

// ==========================================================================
// Form Validation & State
// ==========================================================================

function validateForm() {
  clearFormErrors();
  let isValid = true;

  if (!elements.formTitle.value.trim()) {
    elements.titleError.textContent = "Please enter an assignment title.";
    isValid = false;
  }

  if (!elements.formSubject.value) {
    elements.subjectError.textContent = "Please select a subject.";
    isValid = false;
  } else if (elements.formSubject.value === "Other" && !elements.formCustomSubject.value.trim()) {
    elements.subjectError.textContent = "Please enter the custom subject name.";
    isValid = false;
  }

  // Question PDF validation
  const hasFile = elements.formPdf.files && elements.formPdf.files.length > 0;
  const isEditing = Boolean(state.editingId);

  if (!isEditing && !hasFile) {
    elements.pdfError.textContent = "Please upload an assignment question PDF.";
    isValid = false;
  } else if (hasFile) {
    const file = elements.formPdf.files[0];
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      elements.pdfError.textContent = "Only PDF documents (.pdf) are allowed.";
      isValid = false;
    } else if (file.size > 10 * 1024 * 1024) {
      elements.pdfError.textContent = "File size exceeds the 10MB maximum limit.";
      isValid = false;
    }
  }

  if (!elements.formDueDate.value) {
    elements.dueDateError.textContent = "Please choose a valid deadline date and time.";
    isValid = false;
  }

  return isValid;
}

function clearFormErrors() {
  elements.titleError.textContent = "";
  elements.subjectError.textContent = "";
  elements.dueDateError.textContent = "";
  if (elements.pdfError) elements.pdfError.textContent = "";
}

function handleFileSelection(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    elements.pdfError.textContent = "Please select a valid PDF document (.pdf).";
    elements.dropzoneText.textContent = "Invalid file type (PDF required)";
    return;
  }
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    elements.pdfError.textContent = "File size exceeds the 10MB maximum limit.";
    elements.dropzoneText.textContent = "File too large (max 10MB)";
    return;
  }
  elements.pdfError.textContent = "";
  elements.dropzoneText.textContent = `${file.name} (${formatBytes(file.size)})`;
}

function resetDropzoneText() {
  if (state.editingId) {
    elements.dropzoneText.textContent = "Choose new PDF to replace (optional)";
  } else {
    elements.dropzoneText.textContent = "Choose question PDF or drag & drop";
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function setFormLoading(isLoading) {
  elements.drawerSubmitBtn.disabled = isLoading;
  elements.drawerCancelBtn.disabled = isLoading;
  elements.submitSpinner.style.display = isLoading ? "inline-block" : "none";
  elements.submitBtnText.style.display = isLoading ? "none" : "inline";
}

// ==========================================================================
// UI Helpers & States
// ==========================================================================

function showLoadingState() {
  elements.assignmentsTable.style.display = "none";
  elements.emptyState.style.display = "none";
  elements.errorState.style.display = "none";
  elements.loadingState.style.display = "flex";
}

function showErrorState(msg) {
  elements.assignmentsTable.style.display = "none";
  elements.emptyState.style.display = "none";
  elements.loadingState.style.display = "none";
  elements.errorState.style.display = "flex";
  elements.errorMessageText.textContent = msg;
}

function hideAllStates() {
  elements.loadingState.style.display = "none";
  elements.errorState.style.display = "none";
}

/**
 * Updates dynamic options in the subject filter dropdown based on loaded data
 */
function updateSubjectFilterOptions(assignments) {
  const defaultSubjects = ["Computer Science", "Mathematics", "Science", "Design"];
  const dynamicSubjects = new Set(defaultSubjects);

  assignments.forEach((a) => {
    if (a.subject && a.subject.trim()) {
      dynamicSubjects.add(a.subject.trim());
    }
  });

  const currentSelection = elements.subjectFilter.value;
  elements.subjectFilter.innerHTML = '<option value="all">All Subjects</option>';

  Array.from(dynamicSubjects)
    .sort()
    .forEach((subj) => {
      const option = document.createElement("option");
      option.value = subj;
      option.textContent = subj;
      if (subj === currentSelection) {
        option.selected = true;
      }
      elements.subjectFilter.appendChild(option);
    });
}

/**
 * Shows temporary toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================================================
// Formatting & Utilities
// ==========================================================================

function formatDisplayDate(dateStr) {
  if (!dateStr) return "No deadline";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

function formatDisplayDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return dateStr;
  }
}

function formatInputDate(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const pad = (num) => String(num).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return "";
  }
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================================================
// Authentication & Role-Based Access Control
// ==========================================================================

/**
 * Checks existing session against GET /api/auth/me
 */
async function checkCurrentUser() {
  try {
    const res = await fetch(API_ENDPOINTS.authMe, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const user = await res.json();
      state.currentUser = user;
      updateUserUI(user);
      await fetchClasses();
      const initialRoute = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase() || "dashboard";
      navigateToView(initialRoute, false);
    } else {
      state.currentUser = null;
      updateUserUI(null);
      openAuthModal("signin");
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    state.currentUser = null;
    updateUserUI(null);
    openAuthModal("signin");
  }
}

/**
 * Updates UI elements according to the active user and role
 */
function updateUserUI(user) {
  if (user) {
    const initial = (user.full_name || user.email || "U").charAt(0).toUpperCase();
    const roleCapitalized = capitalize(user.role);

    // Top Bar Profile
    if (elements.profileAvatarText) elements.profileAvatarText.textContent = initial;
    if (elements.profileBtn) {
      elements.profileBtn.title = `${user.full_name} (${roleCapitalized})`;
      elements.profileBtn.setAttribute("aria-label", `${user.full_name} (${roleCapitalized})`);
    }

    // Profile Dropdown
    if (elements.profileMenuAvatar) elements.profileMenuAvatar.textContent = initial;
    if (elements.profileMenuName) elements.profileMenuName.textContent = user.full_name;
    if (elements.profileMenuEmail) elements.profileMenuEmail.textContent = user.email;
    if (elements.profileMenuRole) {
      elements.profileMenuRole.textContent = roleCapitalized;
      elements.profileMenuRole.className = `role-badge ${user.role}`;
    }

    // Sidebar Profile
    if (elements.sidebarAvatar) elements.sidebarAvatar.textContent = initial;
    if (elements.sidebarUserName) elements.sidebarUserName.textContent = user.full_name;
    if (elements.sidebarUserRole) elements.sidebarUserRole.textContent = roleCapitalized;

    // Sidebar navigation titles & global search placeholder
    if (user.role === "teacher") {
      if (elements.navTextAssignments) elements.navTextAssignments.textContent = "Assignments";
      if (elements.navTextClasses) elements.navTextClasses.textContent = "Classes";
      if (elements.navTextSubmissions) elements.navTextSubmissions.textContent = "Submissions";
      if (elements.navTextAnalytics) elements.navTextAnalytics.textContent = "Analytics";
      if (elements.globalSearchInput) elements.globalSearchInput.placeholder = "Search assignments, classes, students...";
    } else {
      if (elements.navTextAssignments) elements.navTextAssignments.textContent = "My Assignments";
      if (elements.navTextClasses) elements.navTextClasses.textContent = "My Classes";
      if (elements.navTextSubmissions) elements.navTextSubmissions.textContent = "My Submissions";
      if (elements.navTextAnalytics) elements.navTextAnalytics.textContent = "Results";
      if (elements.globalSearchInput) elements.globalSearchInput.placeholder = "Search assignments, classes, subjects...";
    }

    // Role-based visibility
    if (user.role === "teacher") {
      if (elements.openCreateDrawerBtn) elements.openCreateDrawerBtn.style.display = "inline-flex";
      if (elements.mobileFabBtn) elements.mobileFabBtn.style.display = "flex";
      if (elements.emptyStateCreateBtn) elements.emptyStateCreateBtn.style.display = "inline-flex";
      if (elements.openClassesModalBtn) elements.openClassesModalBtn.style.display = "inline-flex";
      if (elements.classesBtnText) elements.classesBtnText.textContent = "My Classes";
      if (elements.formClassGroup) elements.formClassGroup.style.display = "flex";
    } else {
      // Student
      if (elements.openCreateDrawerBtn) elements.openCreateDrawerBtn.style.display = "none";
      if (elements.mobileFabBtn) elements.mobileFabBtn.style.display = "none";
      if (elements.emptyStateCreateBtn) elements.emptyStateCreateBtn.style.display = "none";
      if (elements.openClassesModalBtn) elements.openClassesModalBtn.style.display = "inline-flex";
      if (elements.classesBtnText) elements.classesBtnText.textContent = "My Classes";
      if (elements.formClassGroup) elements.formClassGroup.style.display = "none";
    }
  } else {
    // Unauthenticated Guest
    if (elements.profileAvatarText) elements.profileAvatarText.textContent = "?";
    if (elements.profileBtn) elements.profileBtn.title = "Not signed in";
    if (elements.profileMenuAvatar) elements.profileMenuAvatar.textContent = "?";
    if (elements.profileMenuName) elements.profileMenuName.textContent = "Not signed in";
    if (elements.profileMenuEmail) elements.profileMenuEmail.textContent = "";
    if (elements.profileMenuRole) {
      elements.profileMenuRole.textContent = "Guest";
      elements.profileMenuRole.className = "role-badge guest";
    }

    if (elements.sidebarAvatar) elements.sidebarAvatar.textContent = "?";
    if (elements.sidebarUserName) elements.sidebarUserName.textContent = "Guest";
    if (elements.sidebarUserRole) elements.sidebarUserRole.textContent = "Not signed in";

    if (elements.openCreateDrawerBtn) elements.openCreateDrawerBtn.style.display = "none";
    if (elements.mobileFabBtn) elements.mobileFabBtn.style.display = "none";
    if (elements.emptyStateCreateBtn) elements.emptyStateCreateBtn.style.display = "none";
    if (elements.openClassesModalBtn) elements.openClassesModalBtn.style.display = "none";
  }
}

// ==========================================================================
// Dashboard View & Rendering Architecture
// ==========================================================================

const AVATAR_PALETTE = ["#6366f1", "#0284c7", "#8b5cf6", "#0d9488", "#f59e0b", "#ec4899", "#3b82f6", "#10b981"];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

function formatDateBadge(dateStr) {
  if (!dateStr) return { month: "DEC", day: "01" };
  try {
    const d = new Date(dateStr);
    const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const day = d.getDate();
    return { month, day };
  } catch (e) {
    return { month: "DUE", day: "" };
  }
}

const STUDY_ILLUSTRATION_SVG = `
<svg width="150" height="90" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 115 H190" stroke="#bbf7d0" stroke-width="4" stroke-linecap="round"/>
  <path d="M180 115 V90 C180 80 190 70 195 65 C190 75 185 85 185 95" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="188" cy="75" rx="6" ry="12" transform="rotate(25 188 75)" fill="#22c55e" opacity="0.85"/>
  <ellipse cx="178" cy="85" rx="5" ry="10" transform="rotate(-30 178 85)" fill="#15803d" opacity="0.85"/>
  <path d="M176 115 H192 L189 100 H179 Z" fill="#e2e8f0"/>
  <rect x="25" y="105" width="35" height="8" rx="2" fill="#3b82f6"/>
  <rect x="28" y="97" width="30" height="7" rx="2" fill="#f59e0b"/>
  <rect x="30" y="90" width="26" height="6" rx="2" fill="#ef4444"/>
  <rect x="145" y="60" width="6" height="50" rx="3" fill="#64748b"/>
  <path d="M110 65 C115 55 135 55 142 65 L146 115 H115 Z" fill="#2563eb"/>
  <circle cx="126" cy="40" r="12" fill="#fed7aa"/>
  <path d="M118 36 C118 28 126 24 135 27 C138 31 138 36 136 40 C132 38 124 38 118 36 Z" fill="#0f172a"/>
  <path d="M130 75 L105 88 L95 95" stroke="#fed7aa" stroke-width="6" stroke-linecap="round"/>
  <path d="M125 72 L112 85" stroke="#1d4ed8" stroke-width="7" stroke-linecap="round"/>
  <path d="M70 102 L102 102 L106 110 L66 110 Z" fill="#94a3b8"/>
  <path d="M72 102 L85 70 L115 70 L102 102 Z" fill="#1e293b"/>
  <path d="M74 100 L86 73 L113 73 L101 100 Z" fill="#38bdf8"/>
  <circle cx="98" cy="85" r="4" fill="#ffffff" opacity="0.9"/>
</svg>
`;

const SUPPORTED_VIEWS = ["dashboard", "assignments", "classes", "submissions", "calendar", "analytics", "settings"];

/**
 * Switch primary view and keep URL hash + sidebar synchronized
 */
function navigateToView(viewName, updateHash = true) {
  let targetView = (viewName || "").toLowerCase().trim();
  if (!SUPPORTED_VIEWS.includes(targetView)) {
    targetView = "dashboard";
  }

  state.activeView = targetView;

  if (updateHash) {
    if (window.location.hash !== `#${targetView}`) {
      window.location.hash = `#${targetView}`;
    }
  }

  // 1. Hide all page-view sections
  document.querySelectorAll(".page-view").forEach((viewEl) => {
    viewEl.style.display = "none";
  });

  // 2. Display the selected view section
  const targetElement = document.getElementById(`${targetView}View`);
  if (targetElement) {
    targetElement.style.display = targetView === "dashboard" ? "flex" : "block";
  }

  // 3. Synchronize active highlight in sidebar
  elements.navLinks.forEach((link) => link.classList.remove("active"));
  const activeLink = document.querySelector(`.nav-link[data-nav="${targetView}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  // 4. Trigger view-specific data loading
  if (targetView === "dashboard") {
    fetchDashboard();
  } else if (targetView === "assignments") {
    fetchAssignments();
  } else if (targetView === "classes") {
    loadClassesPageView();
  } else if (targetView === "submissions") {
    loadSubmissionsPageView();
  } else if (targetView === "calendar") {
    loadCalendarPageView();
  } else if (targetView === "analytics") {
    loadAnalyticsPageView();
  } else if (targetView === "settings") {
    loadSettingsPageView();
  }
}

/**
 * Renders the standalone Classes page
 */
async function loadClassesPageView() {
  if (!elements.classesPageContent) return;

  const isTeacher = state.currentUser?.role === "teacher";
  if (elements.classesPageTitle) {
    elements.classesPageTitle.textContent = isTeacher ? "Classes" : "My Classes";
  }
  if (elements.classesPageSubtitle) {
    elements.classesPageSubtitle.textContent = isTeacher
      ? "Manage your classes, share join codes with students, and view rosters."
      : "View your enrolled courses and join new classrooms using join codes.";
  }
  if (elements.classesPageActionText) {
    elements.classesPageActionText.textContent = isTeacher ? "Create Class" : "Join Class";
  }

  await fetchClasses();

  if (isTeacher) {
    if (!state.classes || state.classes.length === 0) {
      elements.classesPageContent.innerHTML = `
        <div class="dash-empty-state" style="padding: 3rem 1rem; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div class="empty-icon-circle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3>No classes created yet</h3>
          <p>Create your first class to generate a join code and start enrolling students.</p>
          <button class="btn btn-primary" onclick="openClassesModal()" style="margin-top: 1rem;">Create Class</button>
        </div>
      `;
      return;
    }

    const cardsHtml = state.classes.map((cls) => `
      <div class="class-box-card">
        <div class="class-card-top">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
            <h3 class="class-card-title">${escapeHtml(cls.name)}</h3>
            <span class="class-join-code-badge" onclick="copyJoinCode('${escapeHtml(cls.join_code)}')" title="Click to copy join code">
              ${escapeHtml(cls.join_code)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </span>
          </div>
          <p class="class-card-desc">${escapeHtml(cls.description || "Computer Science Engineering")}</p>
        </div>
        <div class="class-card-bottom">
          <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: #64748b; font-weight: 500;">
            <span>${cls.student_count || 0} students</span>
            <span>&bull;</span>
            <span>${cls.assignment_count || 0} assignments</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openClassStudentsView(${cls.id}, '${escapeHtml(cls.name)}')">View Students</button>
        </div>
      </div>
    `).join("");

    elements.classesPageContent.innerHTML = `
      <div class="classes-cards-grid">
        ${cardsHtml}
      </div>
    `;
  } else {
    if (!state.classes || state.classes.length === 0) {
      elements.classesPageContent.innerHTML = `
        <div class="dash-empty-state" style="padding: 3rem 1rem; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div class="empty-icon-circle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            </svg>
          </div>
          <h3>Not enrolled in any classes yet</h3>
          <p>Join a class using the 6-character code provided by your teacher.</p>
          <button class="btn btn-primary" onclick="openClassesModal()" style="margin-top: 1rem;">Join Class</button>
        </div>
      `;
      return;
    }

    const cardsHtml = state.classes.map((cls) => `
      <div class="class-box-card">
        <div class="class-card-top">
          <h3 class="class-card-title">${escapeHtml(cls.name)}</h3>
          <p class="class-card-desc">${escapeHtml(cls.description || "Course details")}</p>
        </div>
        <div class="class-card-bottom">
          <span class="student-class-teacher">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>${escapeHtml(cls.teacher_name || "Instructor")}</span>
          </span>
          <span class="dash-pill pill-graded">Enrolled</span>
        </div>
      </div>
    `).join("");

    elements.classesPageContent.innerHTML = `
      <div class="classes-cards-grid">
        ${cardsHtml}
      </div>
    `;
  }
}

function copyJoinCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Join code "${code}" copied to clipboard!`, "success");
    }).catch(() => {
      showToast(`Join code: ${code}`, "info");
    });
  } else {
    showToast(`Join code: ${code}`, "info");
  }
}

/**
 * Renders the standalone Submissions page
 */
async function loadSubmissionsPageView() {
  if (!elements.submissionsPageTable) return;

  const isTeacher = state.currentUser?.role === "teacher";
  if (elements.submissionsPageTitle) {
    elements.submissionsPageTitle.textContent = isTeacher ? "Submissions" : "My Submissions";
  }
  if (elements.submissionsPageSubtitle) {
    elements.submissionsPageSubtitle.textContent = isTeacher
      ? "Review student submitted work, timeliness, and submission files across your assignments."
      : "Track your completed submissions, submission times, and download submitted work files.";
  }

  // Set Table Header
  if (elements.submissionsTableHead) {
    if (isTeacher) {
      elements.submissionsTableHead.innerHTML = `
        <tr>
          <th style="width: 50px;">#</th>
          <th>Student</th>
          <th>Assignment</th>
          <th>Class</th>
          <th>Submitted At</th>
          <th>Status</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr>
      `;
    } else {
      elements.submissionsTableHead.innerHTML = `
        <tr>
          <th style="width: 40px;">#</th>
          <th>Assignment</th>
          <th>Submitted File</th>
          <th>Submitted At</th>
          <th>Timing</th>
          <th>Review Status</th>
          <th>Grade</th>
          <th style="text-align: right;">Actions</th>
        </tr>
      `;
    }
  }

  if (elements.submissionsLoadingState) elements.submissionsLoadingState.style.display = "flex";
  if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "none";
  if (elements.submissionsTableBody) elements.submissionsTableBody.innerHTML = "";

  try {
    const res = await fetch(API_ENDPOINTS.submissions, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      state.submissionsData = await res.json();
      filterAndRenderSubmissions();
    } else {
      state.submissionsData = [];
      filterAndRenderSubmissions();
    }
  } catch (err) {
    console.error("Submissions load error:", err);
    state.submissionsData = [];
    filterAndRenderSubmissions();
  } finally {
    if (elements.submissionsLoadingState) elements.submissionsLoadingState.style.display = "none";
  }
}

function filterAndRenderSubmissions() {
  const isTeacher = state.currentUser?.role === "teacher";
  const search = (elements.submissionsSearchInput?.value || "").trim().toLowerCase();
  const statusFilter = elements.submissionsStatusFilter?.value || "all";

  let list = state.submissionsData || [];

  if (search) {
    list = list.filter((s) => {
      const matchTitle = (s.assignment_title || "").toLowerCase().includes(search);
      const matchStudent = (s.student_name || "").toLowerCase().includes(search);
      const matchClass = (s.class_name || "").toLowerCase().includes(search);
      return matchTitle || matchStudent || matchClass;
    });
  }

  if (statusFilter === "ontime") {
    list = list.filter((s) => !s.is_late);
  } else if (statusFilter === "late") {
    list = list.filter((s) => s.is_late);
  }

  if (!list.length) {
    if (elements.submissionsTableBody) elements.submissionsTableBody.innerHTML = "";
    if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "flex";
    if (elements.submissionsEmptyTitle) {
      elements.submissionsEmptyTitle.textContent = search ? "No matching submissions" : "No submissions found";
    }
    if (elements.submissionsEmptyText) {
      elements.submissionsEmptyText.textContent = search
        ? "Try adjusting your search query or filter."
        : (isTeacher ? "No student work has been submitted yet for your assignments." : "You have not submitted work for any assignments yet.");
    }
    return;
  }

  if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "none";

  const rows = list.map((s, idx) => {
    const statusPill = s.is_late
      ? `<span class="dash-pill pill-overdue">Late</span>`
      : `<span class="dash-pill pill-submitted">On-Time</span>`;
    const submittedTime = formatDisplayDateTime(s.submitted_at);
    const notesText = s.notes ? escapeHtml(s.notes) : "—";
    const isPdf = (s.file_name || "").toLowerCase().endsWith(".pdf");
    const previewBtn = `
      <button class="table-action-btn preview-btn preview-sub-btn" data-index="${idx}" type="button" title="${isPdf ? 'Preview PDF submission' : 'Preview submission'}" aria-label="Preview submission">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    `;
    const downloadBtn = `
      <a href="${s.download_url}" class="table-action-btn download-btn" download title="Download ${escapeHtml(s.file_name)}" aria-label="Download submission">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
    `;

    if (isTeacher) {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(s.student_name)}</div>
            <div style="font-size: 0.775rem; color: #64748b;">${escapeHtml(s.student_email)}</div>
          </td>
          <td><strong>${escapeHtml(s.assignment_title)}</strong></td>
          <td>${escapeHtml(s.class_name)}</td>
          <td>${submittedTime}</td>
          <td>${statusPill}</td>
          <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${notesText}</td>
          <td>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button class="btn btn-secondary btn-xs submissions-review-btn" data-index="${idx}" type="button" title="Review & Grade in SpeedGrader">
                Review &amp; Grade
              </button>
              ${previewBtn}
              ${downloadBtn}
            </div>
          </td>
        </tr>
      `;
    } else {
      const isReleased = s.status === "released" && s.grade !== null && s.grade !== undefined;
      const timingBadge = s.is_late
        ? `<span class="submission-pill status-late">Late</span>`
        : `<span class="submission-pill status-ontime">On-Time</span>`;
      const reviewBadge = isReleased
        ? `<span class="submission-pill status-released">Released</span>`
        : `<span class="submission-pill status-ungraded">Pending Review</span>`;
      const gradeHtml = isReleased
        ? `<strong>${s.grade}</strong> / ${s.max_marks || 100} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${Math.round((s.grade / (s.max_marks || 100)) * 100)}%)</span>`
        : `<span style="color: var(--text-muted); font-size: 0.825rem;">Pending Review</span>`;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(s.assignment_title)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(s.class_name)}</div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(s.file_name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${formatBytes(s.file_size)}</div>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">${submittedTime}</td>
          <td>${timingBadge}</td>
          <td>${reviewBadge}</td>
          <td style="font-size: 0.875rem;">${gradeHtml}</td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
              <button class="btn btn-secondary btn-xs view-sub-details-btn" data-index="${idx}" type="button">
                View Details
              </button>
              ${previewBtn}
              ${downloadBtn}
            </div>
          </td>
        </tr>
      `;
    }
  }).join("");

  if (elements.submissionsTableBody) {
    elements.submissionsTableBody.innerHTML = rows;

    if (isTeacher) {
      // Review & Grade buttons on Teacher submissions page
      const reviewBtns = elements.submissionsTableBody.querySelectorAll(".submissions-review-btn");
      reviewBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            const sub = list[idx];
            state.currentGradingAssignment = {
              id: sub.assignment_id,
              title: sub.assignment_title,
              class_name: sub.class_name,
              max_marks: sub.max_marks || 100,
            };
            state.currentGradingSubmissions = [sub];
            openGradingWorkspace(0);
          }
        });
      });

      // Preview buttons on Teacher submissions page open directly in SpeedGrader
      const previewBtns = elements.submissionsTableBody.querySelectorAll(".preview-sub-btn");
      previewBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            const sub = list[idx];
            state.currentGradingAssignment = {
              id: sub.assignment_id,
              title: sub.assignment_title,
              class_name: sub.class_name,
              max_marks: sub.max_marks || 100,
            };
            state.currentGradingSubmissions = [sub];
            openGradingWorkspace(0);
          }
        });
      });
    } else {
      // Student details and preview buttons
      const detailBtns = elements.submissionsTableBody.querySelectorAll(".view-sub-details-btn");
      detailBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            const subItem = list[idx];
            openViewSubmissionModal(
              { id: subItem.assignment_id, title: subItem.assignment_title, class_name: subItem.class_name },
              subItem
            );
          }
        });
      });

      const previewBtns = elements.submissionsTableBody.querySelectorAll(".preview-sub-btn");
      previewBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            openSubmissionPreviewModal(list[idx]);
          }
        });
      });
    }
  }
}

/**
 * Renders the standalone Calendar page
 */
async function loadCalendarPageView() {
  if (!elements.calendarDeadlinesList) return;

  if (!state.assignments || !state.assignments.length) {
    await fetchAssignments();
  }

  const now = new Date();
  if (elements.calendarCurrentMonthLabel) {
    elements.calendarCurrentMonthLabel.textContent = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const sortedAssignments = [...(state.assignments || [])]
    .filter((a) => a.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  if (!sortedAssignments.length) {
    elements.calendarDeadlinesList.innerHTML = `
      <div class="dash-empty-state" style="padding: 2.5rem 1rem;">
        <p>No assignment deadlines scheduled.</p>
      </div>
    `;
  } else {
    const listHtml = sortedAssignments.map((asgn) => {
      const badge = formatDateBadge(asgn.due_date);
      const days = calculateDaysRemaining(asgn.due_date);
      const chipClass = days < 0 ? "days-left-chip" : (days <= 2 ? "days-left-chip warning" : "days-left-chip muted");
      const daysText = days < 0 ? "Overdue" : (days === 0 ? "Due Today" : `${days} days left`);
      return `
        <div class="calendar-item" onclick="navigateToView('assignments', true)">
          <div class="dash-item-main">
            <div class="dash-date-badge">
              <span class="dash-date-month">${badge.month}</span>
              <span class="dash-date-day">${badge.day}</span>
            </div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(asgn.title)}</span>
              <span class="dash-item-sub">${escapeHtml(asgn.class_name || asgn.subject || "General")}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <span class="${chipClass}">${daysText}</span>
          </div>
        </div>
      `;
    }).join("");

    elements.calendarDeadlinesList.innerHTML = listHtml;
  }

  renderMiniCalendar(now, sortedAssignments);
}

function calculateDaysRemaining(dateStr) {
  if (!dateStr) return 0;
  const now = new Date();
  const due = new Date(dateStr);
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderMiniCalendar(currentDate, assignments) {
  if (!elements.calendarMiniMonthContainer) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const today = currentDate.getDate();

  const deadlineDays = new Set();
  assignments.forEach((a) => {
    if (!a.due_date) return;
    const d = new Date(a.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      deadlineDays.add(d.getDate());
    }
  });

  let html = `
    <table class="calendar-mini-table">
      <thead>
        <tr><th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th></tr>
      </thead>
      <tbody><tr>
  `;

  for (let i = 0; i < firstDayIndex; i++) {
    html += `<td></td>`;
  }

  let currentDay = 1;
  let dayOfWeek = firstDayIndex;

  while (currentDay <= lastDay) {
    if (dayOfWeek === 7) {
      html += `</tr><tr>`;
      dayOfWeek = 0;
    }

    const isToday = currentDay === today;
    const hasDeadline = deadlineDays.has(currentDay);
    let classes = [];
    if (isToday) classes.push("today");
    if (hasDeadline) classes.push("has-deadline");

    html += `<td class="${classes.join(" ")}" title="${hasDeadline ? 'Assignment deadline on this date' : ''}">${currentDay}</td>`;

    currentDay++;
    dayOfWeek++;
  }

  while (dayOfWeek < 7) {
    html += `<td></td>`;
    dayOfWeek++;
  }

  html += `</tr></tbody></table>`;

  elements.calendarMiniMonthContainer.innerHTML = html;
}

/**
 * Renders the standalone Analytics page
 */
async function loadAnalyticsPageView() {
  if (!elements.analyticsKpiRow) return;

  const isTeacher = state.currentUser?.role === "teacher";
  if (elements.analyticsPageTitle) {
    elements.analyticsPageTitle.textContent = isTeacher ? "Analytics & Reports" : "Results & Academic Progress";
  }
  if (elements.analyticsPageSubtitle) {
    elements.analyticsPageSubtitle.textContent = isTeacher
      ? "Class-wide submission rates, student engagement metrics, and grading analytics."
      : "Personal assignment completion history, timeliness compliance, and course results.";
  }

  try {
    const res = await fetch(API_ENDPOINTS.dashboard, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const data = await res.json();

    if (isTeacher) {
      const totalSubs = data.submissions_overview?.total || 0;
      const lateSubs = data.submissions_overview?.late || 0;
      const onTimeRate = totalSubs > 0 ? Math.round(((totalSubs - lateSubs) / totalSubs) * 100) + "%" : "100%";

      elements.analyticsKpiRow.innerHTML = `
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.total_assignments}</span>
            <span class="dash-metric-label">Total Assignments</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.total_students}</span>
            <span class="dash-metric-label">Enrolled Students</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-amber"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.pending_grading}</span>
            <span class="dash-metric-label">Total Submissions</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${onTimeRate}</span>
            <span class="dash-metric-label">On-Time Rate</span>
          </div>
        </div>
      `;

      if (elements.analyticsLeftCard) {
        elements.analyticsLeftCard.innerHTML = `
          <div class="dash-card-header"><h2 class="dash-card-title">Submission Breakdown</h2></div>
          <div id="analyticsDonutContainer"></div>
        `;
        const overview = data.submissions_overview || { graded: 0, pending: 0, late: 0, total: 0 };
        renderDonutChart("analyticsDonutContainer", overview.total, "Total", [
          { label: "Graded", value: overview.graded, color: "#10b981" },
          { label: "Pending", value: overview.pending, color: "#3b82f6" },
          { label: "Late", value: overview.late, color: "#ef4444" },
        ]);
      }

      if (elements.analyticsRightCard) {
        const classesList = (data.my_classes || []).map((cls) => `
          <div class="dash-list-item">
            <div class="dash-item-main">
              <div class="dash-icon-box purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
              <div class="dash-item-texts">
                <span class="dash-item-title">${escapeHtml(cls.name)}</span>
                <span class="dash-item-sub">${escapeHtml(cls.description)}</span>
              </div>
            </div>
            <div class="dash-item-meta"><span class="dash-pill pill-new">${cls.student_count || 0} enrolled</span></div>
          </div>
        `).join("");

        elements.analyticsRightCard.innerHTML = `
          <div class="dash-card-header"><h2 class="dash-card-title">Class Distribution</h2></div>
          <div class="dash-list">${classesList || '<div class="dash-empty-state"><p>No classes created yet.</p></div>'}</div>
        `;
      }
    } else {
      const totalAsgns = data.metrics.total_assignments || 0;
      const submitted = data.metrics.submitted || 0;
      const completionRate = totalAsgns > 0 ? Math.round((submitted / totalAsgns) * 100) + "%" : "100%";

      elements.analyticsKpiRow.innerHTML = `
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${totalAsgns}</span>
            <span class="dash-metric-label">Total Assigned</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${submitted}</span>
            <span class="dash-metric-label">Completed</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-amber"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.pending}</span>
            <span class="dash-metric-label">Pending</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${completionRate}</span>
            <span class="dash-metric-label">Completion Rate</span>
          </div>
        </div>
      `;

      if (elements.analyticsLeftCard) {
        elements.analyticsLeftCard.innerHTML = `
          <div class="dash-card-header"><h2 class="dash-card-title">Submission Status</h2></div>
          <div id="analyticsStudentDonutContainer"></div>
        `;
        const statusObj = data.submission_status || { pending: 0, submitted: 0, overdue: 0, total: 0 };
        renderDonutChart("analyticsStudentDonutContainer", statusObj.total, "Total", [
          { label: "Pending", value: statusObj.pending, color: "#3b82f6" },
          { label: "Submitted", value: statusObj.submitted, color: "#10b981" },
          { label: "Overdue", value: statusObj.overdue, color: "#ef4444" },
        ]);
      }

      if (elements.analyticsRightCard) {
        const classesList = (data.my_classes || []).map((cls) => `
          <div class="dash-list-item">
            <div class="dash-item-main">
              <div class="dash-icon-box blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg></div>
              <div class="dash-item-texts">
                <span class="dash-item-title">${escapeHtml(cls.name)}</span>
                <span class="dash-item-sub">${escapeHtml(cls.teacher_name || "Instructor")}</span>
              </div>
            </div>
            <div class="dash-item-meta"><span class="dash-pill pill-graded">Enrolled</span></div>
          </div>
        `).join("");

        elements.analyticsRightCard.innerHTML = `
          <div class="dash-card-header"><h2 class="dash-card-title">Enrolled Classes</h2></div>
          <div class="dash-list">${classesList || '<div class="dash-empty-state"><p>Not enrolled in any classes.</p></div>'}</div>
        `;
      }
    }
  } catch (err) {
    console.error("Analytics fetch error:", err);
  }
}

/**
 * Renders the standalone Settings page
 */
function loadSettingsPageView() {
  if (!state.currentUser) return;
  const initial = (state.currentUser.full_name || state.currentUser.email || "U").charAt(0).toUpperCase();

  if (elements.settingsAvatar) elements.settingsAvatar.textContent = initial;
  if (elements.settingsFullName) elements.settingsFullName.textContent = state.currentUser.full_name || "User";
  if (elements.settingsEmail) elements.settingsEmail.textContent = state.currentUser.email || "";
  if (elements.settingsUserId) elements.settingsUserId.textContent = `#${state.currentUser.id}`;
  if (elements.settingsRoleBadge) {
    elements.settingsRoleBadge.textContent = capitalize(state.currentUser.role);
    elements.settingsRoleBadge.className = `dash-role-pill ${state.currentUser.role}`;
  }

  const savedSort = localStorage.getItem("assignflow_sort_pref");
  if (savedSort && elements.settingsDefaultSort) {
    elements.settingsDefaultSort.value = savedSort;
  }
  const savedReminder = localStorage.getItem("assignflow_reminder_pref");
  if (savedReminder !== null && elements.settingsReminderToggle) {
    elements.settingsReminderToggle.checked = savedReminder === "true";
  }
}

function saveSettingsPreferences() {
  if (elements.settingsDefaultSort) {
    const sortVal = elements.settingsDefaultSort.value;
    localStorage.setItem("assignflow_sort_pref", sortVal);
    state.filters.sort = sortVal;
    if (elements.sortFilter) elements.sortFilter.value = sortVal;
  }
  if (elements.settingsReminderToggle) {
    localStorage.setItem("assignflow_reminder_pref", String(elements.settingsReminderToggle.checked));
  }
  showToast("Preferences saved successfully!", "success");
}

function clearSettingsPreferences() {
  localStorage.removeItem("assignflow_sort_pref");
  localStorage.removeItem("assignflow_reminder_pref");
  if (elements.settingsDefaultSort) elements.settingsDefaultSort.value = "newest";
  if (elements.settingsReminderToggle) elements.settingsReminderToggle.checked = true;
  showToast("Local preferences reset to defaults.", "info");
}

/**
 * Fetches role-scoped dashboard metrics, cards, and donut data
 */
async function fetchDashboard() {
  try {
    const res = await fetch(API_ENDPOINTS.dashboard, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      renderDashboard(data);
    } else if (res.status === 401) {
      openAuthModal("signin");
    } else {
      console.error("Dashboard fetch error:", res.status);
    }
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}

/**
 * Pure SVG Donut Chart Renderer
 */
function renderDonutChart(containerId, centerNumber, centerLabel, segments) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
  const radius = 48;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~301.59

  let circlesHtml = "";
  if (total === 0) {
    circlesHtml = `<circle cx="65" cy="65" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}" />`;
  } else {
    let accumulatedOffset = 0;
    segments.forEach((seg) => {
      const segmentRatio = seg.value / total;
      const strokeDasharray = `${(segmentRatio * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
      const strokeDashoffset = (-accumulatedOffset * circumference).toFixed(2);
      accumulatedOffset += segmentRatio;

      if (seg.value > 0) {
        circlesHtml += `
          <circle cx="65" cy="65" r="${radius}" fill="none"
            stroke="${seg.color}"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${strokeDasharray}"
            stroke-dashoffset="${strokeDashoffset}"
            stroke-linecap="round"
          />
        `;
      }
    });
  }

  const legendHtml = segments
    .map(
      (seg) => `
    <div class="donut-legend-item">
      <div class="donut-legend-left">
        <span class="donut-dot" style="background-color: ${seg.color};"></span>
        <span>${seg.label}</span>
      </div>
      <span class="donut-legend-val">${seg.value}</span>
    </div>
  `
    )
    .join("");

  container.innerHTML = `
    <div class="donut-chart-wrap">
      <div class="donut-svg-container">
        <svg class="donut-svg" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="${strokeWidth}" />
          ${circlesHtml}
        </svg>
        <div class="donut-center-text">
          <span class="donut-center-val">${centerNumber}</span>
          <span class="donut-center-lbl">${centerLabel}</span>
        </div>
      </div>
      <div class="donut-legend">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * Renders complete role-scoped dashboard matching the reference screenshot exactly
 */
function renderDashboard(data) {
  if (!data || !data.user) return;

  const isTeacher = data.role === "teacher";

  // 1. Hero Banner
  if (elements.dashGreeting) elements.dashGreeting.textContent = "Good morning,";
  if (elements.dashUserName) elements.dashUserName.textContent = data.user.full_name || (isTeacher ? "Teacher" : "Student");

  if (elements.dashRolePill) {
    elements.dashRolePill.className = `dash-role-pill ${data.role}`;
  }
  if (elements.dashRolePillText) {
    elements.dashRolePillText.textContent = capitalize(data.role);
  }
  if (elements.dashSubtitle) {
    elements.dashSubtitle.textContent = isTeacher
      ? "Manage your classes, create assignments and track student progress."
      : "Track your assignments, submit work and manage your classes.";
  }
  const dashHeroQuote = document.getElementById("dashHeroQuote");
  if (dashHeroQuote) {
    dashHeroQuote.textContent = isTeacher
      ? "Small submissions build big futures."
      : "Progress over perfection.";
  }
  if (elements.dashHeroCtaBtn) {
    elements.dashHeroCtaBtn.className = isTeacher ? "dash-hero-cta teacher-cta" : "dash-hero-cta student-cta";
  }
  if (elements.dashHeroCtaText) {
    elements.dashHeroCtaText.textContent = isTeacher ? "Create Assignment" : "Join Class";
  }

  // 2. 4 Summary Metrics Row
  if (elements.dashMetricsRow) {
    if (isTeacher) {
      elements.dashMetricsRow.innerHTML = `
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.total_assignments}</span>
            <span class="dash-metric-label">Total Assignments</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.active_assignments}</span>
            <span class="dash-metric-label">Active</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.total_students}</span>
            <span class="dash-metric-label">Total Students</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-coral">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.pending_grading}</span>
            <span class="dash-metric-label">Pending Grading</span>
          </div>
        </div>
      `;
    } else {
      elements.dashMetricsRow.innerHTML = `
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.total_assignments}</span>
            <span class="dash-metric-label">Total Assignments</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.pending}</span>
            <span class="dash-metric-label">Pending</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.submitted}</span>
            <span class="dash-metric-label">Submitted</span>
          </div>
        </div>
        <div class="dash-metric-card">
          <div class="dash-metric-icon icon-coral">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="dash-metric-data">
            <span class="dash-metric-val">${data.metrics.overdue}</span>
            <span class="dash-metric-label">Overdue</span>
          </div>
        </div>
      `;
    }
  }

  // 3. Middle Row Cards
  if (isTeacher) {
    // Left: Recent Submissions
    const submissionsList = (data.recent_submissions || []).map((sub) => {
      const avatarColor = getAvatarColor(sub.student_name);
      const initial = (sub.student_name || "S").charAt(0).toUpperCase();
      return `
        <div class="dash-list-item">
          <div class="dash-item-main">
            <div class="dash-user-avatar" style="background-color: ${avatarColor};">${initial}</div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(sub.student_name)}</span>
              <span class="dash-item-sub">${escapeHtml(sub.assignment_title)}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <span class="dash-item-time">${escapeHtml(sub.relative_time)}</span>
            <span class="dash-pill ${sub.is_late ? "pill-overdue" : "pill-new"}">${sub.is_late ? "Late" : "New"}</span>
          </div>
        </div>
      `;
    }).join("");

    elements.dashMidLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Recent Submissions</h2>
        <button class="dash-card-link" id="linkRecentSubmissionsViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${submissionsList || '<div class="dash-empty-state"><p>No recent submissions yet.</p></div>'}
      </div>
    `;

    document.getElementById("linkRecentSubmissionsViewAll")?.addEventListener("click", () => {
      navigateToView("assignments");
    });

    // Teacher Right: Submissions Overview Donut
    elements.dashMidRightCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Submissions Overview</h2>
      </div>
      <div id="teacherDonutContainer"></div>
    `;
    const overview = data.submissions_overview || { graded: 0, pending: 0, late: 0, total: 0 };
    if (overview.released !== undefined && overview.draft !== undefined && overview.ungraded !== undefined) {
      renderDonutChart("teacherDonutContainer", overview.total, "Total", [
        { label: "Released", value: overview.released, color: "#10b981" },
        { label: "Draft", value: overview.draft, color: "#8b5cf6" },
        { label: "Ungraded", value: overview.ungraded, color: "#f59e0b" },
        { label: "Late", value: overview.late, color: "#ef4444" },
      ]);
    } else {
      renderDonutChart("teacherDonutContainer", overview.total, "Total", [
        { label: "Graded", value: overview.graded, color: "#10b981" },
        { label: "Pending", value: overview.pending, color: "#3b82f6" },
        { label: "Late", value: overview.late, color: "#ef4444" },
      ]);
    }

  } else {
    // Student Left: Upcoming Assignments
    const upcomingList = (data.upcoming_assignments || []).map((asgn) => {
      const formattedDate = formatDisplayDate(asgn.due_date);
      const daysText = asgn.days_left >= 0 ? `${asgn.days_left} days left` : "Overdue";
      const chipClass = asgn.days_left <= 2 ? "days-left-chip" : (asgn.days_left <= 5 ? "days-left-chip warning" : "days-left-chip muted");
      return `
        <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('assignments')">
          <div class="dash-item-main">
            <div class="dash-icon-box blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(asgn.title)}</span>
              <span class="dash-item-sub">${escapeHtml(asgn.class_name)} &bull; ${escapeHtml(asgn.teacher_name)}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem;">
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">${formattedDate}</span>
              <span class="${chipClass}">${daysText}</span>
            </div>
            <svg class="dash-item-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join("");

    elements.dashMidLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Upcoming Assignments</h2>
        <button class="dash-card-link" id="linkStudentUpcomingViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${upcomingList || '<div class="dash-empty-state"><p>No upcoming assignments.</p></div>'}
      </div>
    `;

    document.getElementById("linkStudentUpcomingViewAll")?.addEventListener("click", () => {
      navigateToView("assignments");
    });

    // Student Right: Submission Status Donut
    elements.dashMidRightCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Submission Status</h2>
      </div>
      <div id="studentDonutContainer"></div>
    `;
    const statusObj = data.submission_status || { pending: 0, submitted: 0, overdue: 0, total: 0 };
    if (statusObj.released !== undefined && statusObj.pending_review !== undefined) {
      renderDonutChart("studentDonutContainer", statusObj.total, "Total", [
        { label: "Pending", value: statusObj.pending, color: "#3b82f6" },
        { label: "In Review", value: statusObj.pending_review, color: "#f59e0b" },
        { label: "Released", value: statusObj.released, color: "#10b981" },
        { label: "Overdue", value: statusObj.overdue, color: "#ef4444" },
      ]);
    } else {
      renderDonutChart("studentDonutContainer", statusObj.total, "Total", [
        { label: "Pending", value: statusObj.pending, color: "#3b82f6" },
        { label: "Submitted", value: statusObj.submitted, color: "#10b981" },
        { label: "Overdue", value: statusObj.overdue, color: "#ef4444" },
      ]);
    }
  }

  // 4. Bottom Row Cards
  if (isTeacher) {
    // Left: My Classes
    const classesList = (data.my_classes || []).map((cls) => `
      <div class="dash-list-item">
        <div class="dash-item-main">
          <div class="dash-icon-box purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="dash-item-texts">
            <span class="dash-item-title">${escapeHtml(cls.name)}</span>
            <span class="dash-item-sub">${escapeHtml(cls.description)}</span>
          </div>
        </div>
        <div class="dash-item-meta">
          <span class="dash-item-time">${cls.student_count} students</span>
        </div>
      </div>
    `).join("");

    elements.dashBottomLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">My Classes</h2>
        <button class="dash-card-link" id="linkTeacherClassesViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${classesList || '<div class="dash-empty-state"><p>No classes created yet.</p></div>'}
      </div>
    `;

    document.getElementById("linkTeacherClassesViewAll")?.addEventListener("click", () => {
      openClassesModal();
    });

    // Right: Upcoming Deadlines
    const deadlinesList = (data.upcoming_deadlines || []).map((asgn) => {
      const badge = formatDateBadge(asgn.due_date);
      const daysText = asgn.days_left >= 0 ? `${asgn.days_left} days left` : "Overdue";
      const chipClass = asgn.days_left <= 2 ? "days-left-chip" : (asgn.days_left <= 5 ? "days-left-chip warning" : "days-left-chip muted");
      return `
        <div class="dash-list-item">
          <div class="dash-item-main">
            <div class="dash-date-badge">
              <span class="dash-date-month">${badge.month}</span>
              <span class="dash-date-day">${badge.day}</span>
            </div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(asgn.title)}</span>
              <span class="dash-item-sub">${escapeHtml(asgn.class_name)}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <span class="${chipClass}">${daysText}</span>
          </div>
        </div>
      `;
    }).join("");

    elements.dashBottomRightCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Upcoming Deadlines</h2>
        <button class="dash-card-link" id="linkTeacherDeadlinesViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${deadlinesList || '<div class="dash-empty-state"><p>No upcoming deadlines.</p></div>'}
      </div>
    `;

    document.getElementById("linkTeacherDeadlinesViewAll")?.addEventListener("click", () => {
      navigateToView("assignments");
    });

    // Bottom Full Width: Quick Actions
    elements.dashFullWidthWrap.innerHTML = `
      <div class="dash-quick-actions-card">
        <div class="qa-header">
          <div class="qa-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          </div>
          <div>
            <h2 class="qa-title">Quick Actions</h2>
            <p class="qa-subtitle">Common tasks to manage your classes and assignments</p>
          </div>
        </div>
        <div class="qa-grid">
          <button class="qa-tile" id="qaTileCreateAssignment" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <span>Create Assignment</span>
          </button>
          <button class="qa-tile" id="qaTileManageClasses" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Manage Classes</span>
          </button>
          <button class="qa-tile" id="qaTileReviewSubmissions" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Review Submissions</span>
          </button>
          <button class="qa-tile" id="qaTileViewAnalytics" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>View Analytics</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById("qaTileCreateAssignment")?.addEventListener("click", () => openDrawer());
    document.getElementById("qaTileManageClasses")?.addEventListener("click", () => openClassesModal());
    document.getElementById("qaTileReviewSubmissions")?.addEventListener("click", () => navigateToView("assignments"));
    document.getElementById("qaTileViewAnalytics")?.addEventListener("click", () => showToast("Analytics dashboard is coming soon!", "info"));

  } else {
    // Student Bottom Row
    // Left: Recently Submitted
    const recentlySubmittedList = (data.recently_submitted || []).map((sub) => {
      const formattedDate = formatDisplayDate(sub.submitted_at);
      let statusBadge = "";
      if (sub.status === "Released" && sub.grade !== null && sub.grade !== undefined) {
        statusBadge = `<span class="submission-pill status-released">Released: ${sub.grade}/${sub.max_marks || 100}</span>`;
      } else {
        statusBadge = `<span class="submission-pill status-ungraded">Pending Review</span>`;
      }
      return `
        <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('submissions')">
          <div class="dash-item-main">
            <div class="dash-icon-box purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(sub.assignment_title)}</span>
              <span class="dash-item-sub">${escapeHtml(sub.class_name)}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <span class="dash-item-time">${formattedDate}</span>
            ${statusBadge}
          </div>
        </div>
      `;
    }).join("");

    elements.dashBottomLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Recently Submitted</h2>
        <button class="dash-card-link" id="linkStudentRecentlySubmittedViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${recentlySubmittedList || '<div class="dash-empty-state"><p>No submissions yet.</p></div>'}
      </div>
    `;

    document.getElementById("linkStudentRecentlySubmittedViewAll")?.addEventListener("click", () => {
      navigateToView("submissions");
    });

    // Right: My Classes
    const enrolledClassesList = (data.my_classes || []).map((cls) => `
      <div class="dash-list-item">
        <div class="dash-item-main">
          <div class="dash-icon-box blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
              <path d="M6 6h10"></path>
              <path d="M6 10h10"></path>
            </svg>
          </div>
          <div class="dash-item-texts">
            <span class="dash-item-title">${escapeHtml(cls.name)}</span>
            <span class="dash-item-sub">${escapeHtml(cls.description)}</span>
          </div>
        </div>
        <div class="dash-item-meta">
          <span class="student-class-teacher">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>${escapeHtml(cls.teacher_name)}</span>
          </span>
        </div>
      </div>
    `).join("");

    elements.dashBottomRightCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">My Classes</h2>
        <button class="dash-card-link" id="linkStudentClassesViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${enrolledClassesList || '<div class="dash-empty-state"><p>Not enrolled in any classes yet.</p></div>'}
      </div>
    `;

    document.getElementById("linkStudentClassesViewAll")?.addEventListener("click", () => {
      openClassesModal();
    });

    // Bottom Full Width: Keep Going Banner
    elements.dashFullWidthWrap.innerHTML = `
      <div class="dash-keep-going-banner">
        <div class="kg-left">
          <div class="kg-check-circle">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div>
            <h2 class="kg-text-title">Keep Going!</h2>
            <p class="kg-text-desc">You are on track. Complete your pending assignments.</p>
          </div>
        </div>
        <div class="kg-illustration">
          ${STUDY_ILLUSTRATION_SVG}
        </div>
      </div>
    `;
  }
}

/**
 * Toggle account profile dropdown
 */
function toggleProfileMenu() {
  if (!elements.profileMenu) return;
  const isHidden = elements.profileMenu.style.display === "none" || !elements.profileMenu.style.display;
  elements.profileMenu.style.display = isHidden ? "block" : "none";
  elements.profileBtn.setAttribute("aria-expanded", String(isHidden));
}

function closeProfileMenu() {
  if (!elements.profileMenu) return;
  elements.profileMenu.style.display = "none";
  elements.profileBtn.setAttribute("aria-expanded", "false");
}

/**
 * Open authentication modal
 */
function openAuthModal(defaultMode = "signin", alertMsg = null) {
  if (!elements.authModalBackdrop) return;
  elements.authModalBackdrop.style.display = "flex";
  switchAuthMode(defaultMode);

  if (alertMsg) {
    showAuthAlert(alertMsg, "error");
  } else {
    clearAuthAlert();
  }
}

/**
 * Close authentication modal
 */
function closeAuthModal() {
  if (!elements.authModalBackdrop) return;
  elements.authModalBackdrop.style.display = "none";
  clearAuthAlert();
}

/**
 * Switch tabs between Sign In and Create Account
 */
function switchAuthMode(mode) {
  state.authMode = mode;
  clearAuthAlert();

  if (mode === "signin") {
    if (elements.tabSignIn) elements.tabSignIn.classList.add("active");
    if (elements.tabRegister) elements.tabRegister.classList.remove("active");
    if (elements.signInForm) elements.signInForm.style.display = "flex";
    if (elements.registerForm) elements.registerForm.style.display = "none";
    if (elements.loginEmail) setTimeout(() => elements.loginEmail.focus(), 150);
  } else {
    if (elements.tabRegister) elements.tabRegister.classList.add("active");
    if (elements.tabSignIn) elements.tabSignIn.classList.remove("active");
    if (elements.registerForm) elements.registerForm.style.display = "flex";
    if (elements.signInForm) elements.signInForm.style.display = "none";
    if (elements.regFullName) setTimeout(() => elements.regFullName.focus(), 150);
  }
}

function showAuthAlert(message, type = "error") {
  if (!elements.authAlert) return;
  elements.authAlert.className = `auth-alert ${type}`;
  elements.authAlert.textContent = message;
  elements.authAlert.style.display = "flex";
}

function clearAuthAlert() {
  if (!elements.authAlert) return;
  elements.authAlert.style.display = "none";
  elements.authAlert.textContent = "";
}

function setAuthLoading(formType, isLoading) {
  if (formType === "login") {
    if (elements.loginSubmitBtn) elements.loginSubmitBtn.disabled = isLoading;
    if (elements.loginSpinner) elements.loginSpinner.style.display = isLoading ? "inline-block" : "none";
    if (elements.loginBtnText) elements.loginBtnText.style.display = isLoading ? "none" : "inline";
  } else if (formType === "register") {
    if (elements.regSubmitBtn) elements.regSubmitBtn.disabled = isLoading;
    if (elements.regSpinner) elements.regSpinner.style.display = isLoading ? "inline-block" : "none";
    if (elements.regBtnText) elements.regBtnText.style.display = isLoading ? "none" : "inline";
  }
}

/**
 * Handles Sign In form submission
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthAlert();

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!email || !password) {
    showAuthAlert("Please enter both email and password.", "error");
    return;
  }

  setAuthLoading("login", true);

  try {
    const res = await fetch(API_ENDPOINTS.authLogin, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      let detail = errData.detail || "Invalid email or password.";
      if (typeof detail !== "string") {
        detail = JSON.stringify(detail);
      }
      throw new Error(detail);
    }

    const data = await res.json();
    state.currentUser = data.user;
    updateUserUI(data.user);
    closeAuthModal();
    showToast(`Welcome back, ${data.user.full_name}!`, "success");
    await fetchClasses();
    await fetchAssignments();
  } catch (err) {
    console.error("Login failed:", err);
    showAuthAlert(err.message, "error");
  } finally {
    setAuthLoading("login", false);
  }
}

/**
 * Handles Registration form submission
 */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthAlert();

  const full_name = elements.regFullName.value.trim();
  const email = elements.regEmail.value.trim();
  const password = elements.regPassword.value;
  const roleInput = document.querySelector('input[name="accountRole"]:checked');
  const role = roleInput ? roleInput.value : "teacher";

  if (!full_name) {
    showAuthAlert("Please enter your full name.", "error");
    return;
  }
  if (!email) {
    showAuthAlert("Please enter your email address.", "error");
    return;
  }
  if (!password || password.length < 8) {
    showAuthAlert("Password must be at least 8 characters.", "error");
    return;
  }

  setAuthLoading("register", true);

  try {
    const res = await fetch(API_ENDPOINTS.authRegister, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password, full_name, role }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      let detail = errData.detail || "Registration failed.";
      if (typeof detail !== "string") {
        if (Array.isArray(detail)) {
          detail = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          detail = JSON.stringify(detail);
        }
      }
      throw new Error(detail);
    }

    const data = await res.json();
    state.currentUser = data.user;
    updateUserUI(data.user);
    closeAuthModal();
    showToast(`Account created! Welcome, ${data.user.full_name}!`, "success");
    await fetchClasses();
    await fetchAssignments();
  } catch (err) {
    console.error("Registration failed:", err);
    showAuthAlert(err.message, "error");
  } finally {
    setAuthLoading("register", false);
  }
}

/**
 * Handles Logout
 */
async function handleLogout() {
  closeProfileMenu();
  try {
    await fetch(API_ENDPOINTS.authLogout, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    console.warn("Logout request error:", err);
  }

  state.currentUser = null;
  state.assignments = [];
  state.filteredAssignments = [];
  state.classes = [];
  state.mySubmissions = {};
  state.currentSubmittingAssignment = null;
  populateClassFilterOptions([]);
  populateFormClassOptions([]);
  updateUserUI(null);
  renderTable([]);
  updateStatistics([]);
  showToast("Logged out successfully.", "info");
  openAuthModal("signin");
}

// ==========================================================================
// Class Management & Enrollment UI Logic
// ==========================================================================

/**
 * Fetches classes accessible to the current user
 * (Owned classes for teachers, enrolled classes for students)
 */
async function fetchClasses() {
  if (!state.currentUser) {
    state.classes = [];
    populateClassFilterOptions([]);
    populateFormClassOptions([]);
    return;
  }

  try {
    const res = await fetch(API_ENDPOINTS.classes, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      state.classes = data;
      populateClassFilterOptions(data);
      if (state.currentUser.role === "teacher") {
        populateFormClassOptions(data);
        renderTeacherClassesList(data);
      } else {
        renderStudentClassesList(data);
      }
    }
  } catch (err) {
    console.error("Failed to fetch classes:", err);
  }
}

/**
 * Populates toolbar Class filter dropdown
 */
function populateClassFilterOptions(classes) {
  if (!elements.classFilter) return;
  const currentVal = elements.classFilter.value || "all";
  elements.classFilter.innerHTML = '<option value="all">All Classes</option>';

  // Provide option for unassigned assignments if viewing as teacher
  const hasUnassigned = state.assignments && state.assignments.some((a) => !a.class_id);
  if (hasUnassigned && state.currentUser && state.currentUser.role === "teacher") {
    const unassignedOpt = document.createElement("option");
    unassignedOpt.value = "unassigned";
    unassignedOpt.textContent = "General (No Class)";
    elements.classFilter.appendChild(unassignedOpt);
  }

  classes.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = String(cls.id);
    opt.textContent = cls.name;
    elements.classFilter.appendChild(opt);
  });

  if (Array.from(elements.classFilter.options).some((o) => o.value === currentVal)) {
    elements.classFilter.value = currentVal;
    state.filters.classId = currentVal;
  } else {
    elements.classFilter.value = "all";
    state.filters.classId = "all";
  }
}

/**
 * Populates the Publish to Class select in the Create/Edit drawer
 */
function populateFormClassOptions(classes) {
  if (!elements.formClass) return;
  const currentVal = elements.formClass.value || "";
  elements.formClass.innerHTML = '<option value="">General / Unassigned</option>';
  classes.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = String(cls.id);
    opt.textContent = cls.name;
    elements.formClass.appendChild(opt);
  });
  elements.formClass.value = currentVal;
}

/**
 * Opens Classes management modal with appropriate role-based view
 */
function openClassesModal() {
  if (!state.currentUser) {
    openAuthModal("signin", "Please sign in to access classes.");
    return;
  }

  clearClassesAlert();
  if (elements.classesModalBackdrop) {
    elements.classesModalBackdrop.style.display = "flex";
  }

  if (state.currentUser.role === "teacher") {
    if (elements.classesModalTitle) elements.classesModalTitle.textContent = "Manage Classes";
    if (elements.classesModalSubtitle) {
      elements.classesModalSubtitle.textContent = "Create courses, view join codes, and manage enrollments.";
    }
    showTeacherClassesMainView();
  } else {
    if (elements.classesModalTitle) elements.classesModalTitle.textContent = "My Classes";
    if (elements.classesModalSubtitle) {
      elements.classesModalSubtitle.textContent = "Join a class using your teacher's code to access assignments.";
    }
    if (elements.teacherClassesView) elements.teacherClassesView.style.display = "none";
    if (elements.studentClassesView) elements.studentClassesView.style.display = "block";
    if (elements.classStudentsView) elements.classStudentsView.style.display = "none";
  }

  fetchClasses();
}

/**
 * Closes Classes modal
 */
function closeClassesModal() {
  if (elements.classesModalBackdrop) {
    elements.classesModalBackdrop.style.display = "none";
  }
  clearClassesAlert();
}

/**
 * Shows the teacher's main classes list and hides the student roster
 */
function showTeacherClassesMainView() {
  if (elements.teacherClassesView) elements.teacherClassesView.style.display = "block";
  if (elements.studentClassesView) elements.studentClassesView.style.display = "none";
  if (elements.classStudentsView) elements.classStudentsView.style.display = "none";
  clearClassesAlert();
}

/**
 * Renders teacher's class cards
 */
function renderTeacherClassesList(classes) {
  if (elements.teacherClassesCount) {
    elements.teacherClassesCount.textContent = classes.length;
  }
  if (!elements.teacherClassesListContainer) return;

  if (classes.length === 0) {
    elements.teacherClassesListContainer.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        <p>You haven't created any classes yet. Use the form above to create your first class.</p>
      </div>
    `;
    return;
  }

  elements.teacherClassesListContainer.innerHTML = "";
  classes.forEach((cls) => {
    const card = document.createElement("div");
    card.className = "class-card-item";
    card.innerHTML = `
      <div class="class-card-top">
        <div>
          <div class="class-card-name">${escapeHtml(cls.name)}</div>
          ${cls.description ? `<div class="class-card-desc">${escapeHtml(cls.description)}</div>` : ""}
        </div>
        <div class="class-actions-btns">
          <button type="button" class="btn btn-secondary btn-xs btn-view-students" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}">
            👥 Students (${cls.student_count || 0})
          </button>
          <button type="button" class="btn btn-secondary btn-xs btn-delete-class" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}" title="Delete Class" style="color: #ef4444;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="class-card-footer">
        <div class="class-badges-group">
          <div class="join-code-wrapper" title="Click to copy join code" data-code="${escapeHtml(cls.join_code)}" style="cursor: pointer;">
            <span class="join-code-text">${escapeHtml(cls.join_code)}</span>
            <button type="button" class="copy-icon-btn" aria-label="Copy join code">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
        </div>
        <span class="class-count-pill">${cls.assignment_count || 0} assignments</span>
      </div>
    `;

    // Copy join code on click
    const badge = card.querySelector(".join-code-wrapper");
    if (badge) {
      badge.addEventListener("click", () => {
        navigator.clipboard.writeText(cls.join_code).catch(() => {});
        showToast(`Join code "${cls.join_code}" copied to clipboard!`, "info");
      });
    }

    // View students button
    const viewBtn = card.querySelector(".btn-view-students");
    if (viewBtn) {
      viewBtn.addEventListener("click", () => handleViewClassStudents(cls.id, cls.name));
    }

    // Delete class button
    const deleteBtn = card.querySelector(".btn-delete-class");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => handleDeleteClass(cls.id, cls.name));
    }

    elements.teacherClassesListContainer.appendChild(card);
  });
}

/**
 * Renders student's enrolled class cards
 */
function renderStudentClassesList(classes) {
  if (elements.studentClassesCount) {
    elements.studentClassesCount.textContent = classes.length;
  }
  if (!elements.studentClassesListContainer) return;

  if (classes.length === 0) {
    elements.studentClassesListContainer.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        <p>You haven't joined any classes yet. Enter a join code above to access class assignments.</p>
      </div>
    `;
    return;
  }

  elements.studentClassesListContainer.innerHTML = "";
  classes.forEach((cls) => {
    const card = document.createElement("div");
    card.className = "class-card-item";
    card.innerHTML = `
      <div class="class-card-top">
        <div>
          <div class="class-card-name">${escapeHtml(cls.name)}</div>
          ${cls.description ? `<div class="class-card-desc">${escapeHtml(cls.description)}</div>` : ""}
        </div>
        <span class="status-pill status-active" style="font-size: 0.725rem;">Enrolled</span>
      </div>
      <div class="class-card-footer">
        <span class="class-count-pill">Instructor: ${escapeHtml(cls.teacher_name || "Teacher")}</span>
        <span class="class-count-pill">${cls.assignment_count || 0} assignments</span>
      </div>
    `;
    elements.studentClassesListContainer.appendChild(card);
  });
}

/**
 * Handles teacher creating a new class
 */
async function handleCreateClassSubmit(e) {
  e.preventDefault();
  clearClassesAlert();

  const name = elements.newClassName ? elements.newClassName.value.trim() : "";
  const description = elements.newClassDesc ? elements.newClassDesc.value.trim() : "";

  if (!name) {
    showClassesAlert("Please enter a class name.", "error");
    return;
  }

  if (elements.btnCreateClass) elements.btnCreateClass.disabled = true;

  try {
    const res = await fetch(API_ENDPOINTS.classes, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create class (HTTP ${res.status})`);
    }

    const newClass = await res.json();
    if (elements.newClassName) elements.newClassName.value = "";
    if (elements.newClassDesc) elements.newClassDesc.value = "";

    showToast(`Class "${newClass.name}" created! Join code: ${newClass.join_code}`, "success");
    await fetchClasses();
  } catch (err) {
    console.error("Create class error:", err);
    showClassesAlert(err.message, "error");
  } finally {
    if (elements.btnCreateClass) elements.btnCreateClass.disabled = false;
  }
}

/**
 * Handles student joining a class via join code
 */
async function handleJoinClassSubmit(e) {
  e.preventDefault();
  clearClassesAlert();

  const joinCode = elements.studentJoinCode ? elements.studentJoinCode.value.trim().toUpperCase() : "";
  if (!joinCode) {
    showClassesAlert("Please enter a class join code.", "error");
    return;
  }

  if (elements.btnJoinClass) elements.btnJoinClass.disabled = true;

  try {
    const res = await fetch(API_ENDPOINTS.joinClass, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ join_code: joinCode }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to join class (HTTP ${res.status})`);
    }

    const enrolledClass = await res.json();
    if (elements.studentJoinCode) elements.studentJoinCode.value = "";

    showToast(`Successfully enrolled in "${enrolledClass.name}"!`, "success");
    await fetchClasses();
    await fetchAssignments();
  } catch (err) {
    console.error("Join class error:", err);
    showClassesAlert(err.message, "error");
  } finally {
    if (elements.btnJoinClass) elements.btnJoinClass.disabled = false;
  }
}

/**
 * Handles teacher deleting a class
 */
async function handleDeleteClass(classId, className) {
  if (!confirm(`Are you sure you want to delete class "${className}"?\n\nAssignments previously linked to this class will remain intact as unassigned.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to delete class");
    }

    showToast(`Class "${className}" deleted.`, "success");
    await fetchClasses();
    await fetchAssignments();
  } catch (err) {
    console.error("Delete class error:", err);
    showToast(`Error: ${err.message}`, "error");
  }
}

/**
 * Handles teacher opening and viewing students enrolled in a class
 */
async function handleViewClassStudents(classId, className) {
  if (elements.teacherClassesView) elements.teacherClassesView.style.display = "none";
  if (elements.classStudentsView) elements.classStudentsView.style.display = "block";
  if (elements.classStudentsTitle) elements.classStudentsTitle.textContent = `Students in "${className}"`;
  if (elements.studentsTableContainer) {
    elements.studentsTableContainer.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}/students`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load student roster");
    }

    const students = await res.json();
    if (students.length === 0) {
      elements.studentsTableContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
          <p>No students have joined this class yet. Share the class join code with your students.</p>
        </div>
      `;
      return;
    }

    const rowsHtml = students
      .map(
        (st, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(st.student_name)}</strong></td>
          <td>${escapeHtml(st.student_email)}</td>
          <td>${formatDisplayDate(st.enrolled_at)}</td>
        </tr>
      `
      )
      .join("");

    elements.studentsTableContainer.innerHTML = `
      <table class="students-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Student Name</th>
            <th>Email Address</th>
            <th>Joined On</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Error fetching students:", err);
    if (elements.studentsTableContainer) {
      elements.studentsTableContainer.innerHTML = `
        <div class="auth-alert error" style="margin: 1rem;">${escapeHtml(err.message)}</div>
      `;
    }
  }
}

function showClassesAlert(message, type = "error") {
  if (!elements.classesAlert) return;
  elements.classesAlert.className = `auth-alert ${type}`;
  elements.classesAlert.textContent = message;
  elements.classesAlert.style.display = "flex";
}

function clearClassesAlert() {
  if (!elements.classesAlert) return;
  elements.classesAlert.style.display = "none";
  elements.classesAlert.textContent = "";
}

// ==========================================================================
// Student Submissions & Teacher Review UI Logic
// ==========================================================================

/**
 * Fetches the logged-in student's submission status for the provided assignments list
 */
async function fetchStudentSubmissions(assignments) {
  if (!assignments || !assignments.length) return;
  const fetchPromises = assignments.map(async (assignment) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions/me`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const sub = await res.json();
        state.mySubmissions[assignment.id] = sub;
      } else {
        state.mySubmissions[assignment.id] = null;
      }
    } catch (e) {
      state.mySubmissions[assignment.id] = null;
    }
  });
  await Promise.allSettled(fetchPromises);
}

/**
 * Handles file drop or file input selection for student work submission
 */
function handleSubmissionFileSelection(file) {
  if (!file) return;

  const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".zip"];
  const fileName = file.name.toLowerCase();
  const isValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));

  if (!isValidExt) {
    if (elements.submissionFileError) {
      elements.submissionFileError.textContent = "Please select a valid file (.pdf, .docx, .doc, .txt, .zip).";
    }
    resetSubmissionDropzone();
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    if (elements.submissionFileError) {
      elements.submissionFileError.textContent = "File size exceeds the 10MB limit.";
    }
    resetSubmissionDropzone();
    return;
  }

  if (file.size === 0) {
    if (elements.submissionFileError) {
      elements.submissionFileError.textContent = "The selected file is empty.";
    }
    resetSubmissionDropzone();
    return;
  }

  if (elements.submissionFileError) {
    elements.submissionFileError.textContent = "";
  }

  if (elements.submissionFileName) {
    elements.submissionFileName.textContent = file.name;
  }
  if (elements.submissionFileSize) {
    elements.submissionFileSize.textContent = formatBytes(file.size);
  }
  if (elements.submissionDropzoneContent) {
    elements.submissionDropzoneContent.style.display = "none";
  }
  if (elements.submissionFilePreview) {
    elements.submissionFilePreview.style.display = "flex";
  }
}

/**
 * Clears selected file from the submission dropzone
 */
function resetSubmissionDropzone() {
  if (elements.submissionFileInput) {
    elements.submissionFileInput.value = "";
  }
  if (elements.submissionFilePreview) {
    elements.submissionFilePreview.style.display = "none";
  }
  if (elements.submissionDropzoneContent) {
    elements.submissionDropzoneContent.style.display = "flex";
  }
}

/**
 * Opens student submit work dialog
 */
function openSubmitWorkModal(assignment) {
  state.currentSubmittingAssignment = assignment;
  resetSubmissionDropzone();
  if (elements.submissionNotes) elements.submissionNotes.value = "";
  if (elements.submissionFileError) elements.submissionFileError.textContent = "";
  if (elements.submitWorkAlert) {
    elements.submitWorkAlert.style.display = "none";
    elements.submitWorkAlert.textContent = "";
  }

  if (elements.submitWorkAssignmentName) {
    elements.submitWorkAssignmentName.textContent = assignment.title;
  }
  if (elements.submitWorkCourseName) {
    elements.submitWorkCourseName.textContent = assignment.class_name || assignment.subject || "General";
  }
  if (elements.submitWorkDueDate) {
    elements.submitWorkDueDate.textContent = formatDisplayDate(assignment.due_date);
  }

  if (elements.submitWorkModalBackdrop) {
    elements.submitWorkModalBackdrop.style.display = "flex";
  }
}

/**
 * Closes student submit work dialog
 */
function closeSubmitWorkModal() {
  state.currentSubmittingAssignment = null;
  resetSubmissionDropzone();
  if (elements.submitWorkModalBackdrop) {
    elements.submitWorkModalBackdrop.style.display = "none";
  }
}

/**
 * Handles student submission form submission
 */
async function handleSubmitWorkForm(e) {
  e.preventDefault();
  if (!state.currentSubmittingAssignment) return;

  const fileInput = elements.submissionFileInput;
  if (!fileInput.files || fileInput.files.length === 0) {
    if (elements.submissionFileError) {
      elements.submissionFileError.textContent = "Please select a file to submit.";
    }
    return;
  }

  const file = fileInput.files[0];
  const notes = elements.submissionNotes ? elements.submissionNotes.value.trim() : "";

  // Set loading state
  if (elements.btnSubmitWork) elements.btnSubmitWork.disabled = true;
  if (elements.submitWorkSpinner) elements.submitWorkSpinner.style.display = "inline-block";
  if (elements.submitWorkBtnText) elements.submitWorkBtnText.textContent = "Submitting...";
  if (elements.submitWorkAlert) {
    elements.submitWorkAlert.style.display = "none";
    elements.submitWorkAlert.textContent = "";
  }

  const formData = new FormData();
  formData.append("file", file);
  if (notes) {
    formData.append("notes", notes);
  }

  try {
    const response = await fetch(`${API_ENDPOINTS.assignments}/${state.currentSubmittingAssignment.id}/submissions`, {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });

    if (response.status === 401) {
      closeSubmitWorkModal();
      openAuthModal("signin", "Please sign in to submit your work.");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.detail || `Submission failed (HTTP ${response.status})`;
      if (elements.submitWorkAlert) {
        elements.submitWorkAlert.textContent = errorMsg;
        elements.submitWorkAlert.style.display = "block";
      }
      showToast(errorMsg, "error");
      return;
    }

    // Success! Update local state
    state.mySubmissions[state.currentSubmittingAssignment.id] = data;
    closeSubmitWorkModal();
    showToast("Work submitted successfully!", "success");
    applyFiltersAndRender();
  } catch (err) {
    console.error("Submission failed:", err);
    if (elements.submitWorkAlert) {
      elements.submitWorkAlert.textContent = err.message || "Failed to submit work. Please try again.";
      elements.submitWorkAlert.style.display = "block";
    }
    showToast("Submission failed. Please try again.", "error");
  } finally {
    if (elements.btnSubmitWork) elements.btnSubmitWork.disabled = false;
    if (elements.submitWorkSpinner) elements.submitWorkSpinner.style.display = "none";
    if (elements.submitWorkBtnText) elements.submitWorkBtnText.textContent = "Submit Work";
  }
}

/**
 * Opens student's view-submission dialog
 */
async function openViewSubmissionModal(assignment, submission = null) {
  if (!submission && state.mySubmissions[assignment.id]) {
    submission = state.mySubmissions[assignment.id];
  }

  if (!submission) {
    try {
      const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions/me`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        submission = await res.json();
        state.mySubmissions[assignment.id] = submission;
      }
    } catch (e) {
      console.warn("Could not fetch submission details:", e);
    }
  }

  if (!submission) {
    showToast("No submission found for this assignment.", "info");
    return;
  }

  // Assignment Title and Subtitle in modal header
  if (elements.viewSubmissionModalSubtitle) {
    elements.viewSubmissionModalSubtitle.textContent = assignment.title
      ? `${assignment.title} • ${assignment.class_name || "General"}`
      : "Submission details and file";
  }

  // Check if grade is released
  const isReleased = submission.status === "released" && submission.grade !== null && submission.grade !== undefined;
  const maxMarks = submission.max_marks || (assignment && assignment.max_marks ? assignment.max_marks : 100);

  if (isReleased) {
    if (elements.viewSubResultsCard) elements.viewSubResultsCard.style.display = "block";
    if (elements.viewSubPendingBanner) elements.viewSubPendingBanner.style.display = "none";
    if (elements.viewSubScoreVal) elements.viewSubScoreVal.textContent = submission.grade;
    if (elements.viewSubScoreMax) elements.viewSubScoreMax.textContent = maxMarks;
    if (elements.viewSubScorePct) {
      const pct = Math.round((submission.grade / maxMarks) * 100);
      elements.viewSubScorePct.textContent = `(${pct}%)`;
    }

    if (submission.feedback && submission.feedback.trim().length > 0) {
      if (elements.viewSubFeedbackBox) elements.viewSubFeedbackBox.style.display = "block";
      if (elements.viewSubFeedbackText) elements.viewSubFeedbackText.textContent = submission.feedback;
    } else {
      if (elements.viewSubFeedbackBox) elements.viewSubFeedbackBox.style.display = "none";
    }
  } else {
    if (elements.viewSubResultsCard) elements.viewSubResultsCard.style.display = "none";
    if (elements.viewSubPendingBanner) elements.viewSubPendingBanner.style.display = "flex";
  }

  if (elements.viewSubStatusPill) {
    if (submission.is_late) {
      elements.viewSubStatusPill.className = "status-pill status-late";
      elements.viewSubStatusPill.textContent = "Submitted (Late)";
    } else {
      elements.viewSubStatusPill.className = "status-pill status-ontime";
      elements.viewSubStatusPill.textContent = "Submitted (On Time)";
    }
  }

  if (elements.viewSubDate) {
    elements.viewSubDate.textContent = formatDisplayDateTime(submission.submitted_at);
  }

  if (elements.viewSubFileName) {
    elements.viewSubFileName.textContent = submission.file_name;
  }

  if (elements.viewSubFileSize) {
    elements.viewSubFileSize.textContent = formatBytes(submission.file_size);
  }

  if (elements.viewSubNotesBox && elements.viewSubNotes) {
    if (submission.notes) {
      elements.viewSubNotes.textContent = submission.notes;
      elements.viewSubNotesBox.style.display = "block";
    } else {
      elements.viewSubNotesBox.style.display = "none";
    }
  }

  const assignmentId = assignment.id || submission.assignment_id;
  const downloadUrl =
    submission.download_url ||
    `${API_BASE}/api/assignments/${assignmentId}/submissions/${submission.id}/download`;

  if (elements.btnDownloadMySubmission) {
    elements.btnDownloadMySubmission.href = downloadUrl;
    elements.btnDownloadMySubmission.setAttribute("download", submission.file_name);
  }

  // Preview Button for student's own submission (if PDF)
  if (elements.btnPreviewMySubmission) {
    const isPdf = (submission.file_name || "").toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const previewUrl =
        submission.preview_url ||
        `${API_BASE}/api/assignments/${assignmentId}/submissions/${submission.id}/preview`;
      elements.btnPreviewMySubmission.href = previewUrl;
      elements.btnPreviewMySubmission.target = "_blank";
      elements.btnPreviewMySubmission.onclick = null;
      elements.btnPreviewMySubmission.style.display = "inline-flex";
    } else {
      elements.btnPreviewMySubmission.style.display = "none";
    }
  }

  if (elements.viewSubmissionModalBackdrop) {
    elements.viewSubmissionModalBackdrop.style.display = "flex";
  }
}

/**
 * Closes student's view-submission dialog
 */
function closeViewSubmissionModal() {
  if (elements.viewSubmissionModalBackdrop) {
    elements.viewSubmissionModalBackdrop.style.display = "none";
  }
}

/**
 * Opens teacher submissions overview dialog for a specific assignment
 */
async function openTeacherSubmissionsModal(assignment) {
  state.currentGradingAssignment = assignment;
  state.currentGradingSubmissions = [];
  state.currentGradingIndex = 0;
  state.selectedSubmissionIds.clear();

  if (elements.teacherSelectAllSubmissions) {
    elements.teacherSelectAllSubmissions.checked = false;
    elements.teacherSelectAllSubmissions.indeterminate = false;
  }
  if (elements.teacherSelectedCountBanner) {
    elements.teacherSelectedCountBanner.style.display = "none";
  }
  if (elements.teacherSelectedCount) {
    elements.teacherSelectedCount.textContent = "0";
  }

  if (elements.teacherSubmissionsAssignmentTitle) {
    elements.teacherSubmissionsAssignmentTitle.textContent = `${assignment.title} • ${assignment.class_name || assignment.subject || "General"}`;
  }
  if (elements.teacherSubmissionsCount) {
    elements.teacherSubmissionsCount.textContent = "Loading...";
  }
  if (elements.teacherReleaseAllBtn) {
    elements.teacherReleaseAllBtn.style.display = "none";
  }
  if (elements.teacherSubmissionsTableBody) {
    elements.teacherSubmissionsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading submissions...</td></tr>`;
  }
  if (elements.teacherSubmissionsEmptyState) {
    elements.teacherSubmissionsEmptyState.style.display = "none";
  }
  if (elements.teacherSubmissionsTableContainer) {
    elements.teacherSubmissionsTableContainer.style.display = "block";
  }
  if (elements.teacherSubmissionsAlert) {
    elements.teacherSubmissionsAlert.style.display = "none";
    elements.teacherSubmissionsAlert.textContent = "";
  }

  if (elements.teacherSubmissionsModalBackdrop) {
    elements.teacherSubmissionsModalBackdrop.style.display = "flex";
  }

  await fetchTeacherSubmissions(assignment);
}

/**
 * Fetches teacher submissions from API and updates roster
 */
async function fetchTeacherSubmissions(assignment) {
  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (res.status === 401) {
      closeTeacherSubmissionsModal();
      openAuthModal("signin", "Please sign in to view submissions.");
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const submissions = await res.json();
    state.currentGradingSubmissions = submissions;

    if (elements.teacherSubmissionsCount) {
      elements.teacherSubmissionsCount.textContent = submissions.length;
    }

    updateTeacherReleaseAllButton();

    if (submissions.length === 0) {
      if (elements.teacherSubmissionsTableContainer) {
        elements.teacherSubmissionsTableContainer.style.display = "none";
      }
      if (elements.teacherSubmissionsEmptyState) {
        elements.teacherSubmissionsEmptyState.style.display = "flex";
      }
      return;
    }

    if (elements.teacherSubmissionsTableContainer) {
      elements.teacherSubmissionsTableContainer.style.display = "block";
    }
    if (elements.teacherSubmissionsEmptyState) {
      elements.teacherSubmissionsEmptyState.style.display = "none";
    }

    renderTeacherSubmissionsRoster();
  } catch (err) {
    console.error("Error fetching teacher submissions:", err);
    if (elements.teacherSubmissionsTableContainer) {
      elements.teacherSubmissionsTableContainer.style.display = "none";
    }
    if (elements.teacherSubmissionsAlert) {
      elements.teacherSubmissionsAlert.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span>${escapeHtml(err.message || "Failed to load submissions.")}</span>
          <button class="btn btn-secondary btn-xs" id="retryTeacherSubmissionsBtn" type="button">Retry</button>
        </div>
      `;
      elements.teacherSubmissionsAlert.style.display = "block";
      const retryBtn = document.getElementById("retryTeacherSubmissionsBtn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => fetchTeacherSubmissions(assignment));
      }
    }
  }
}

/**
 * Updates submission selection summary UI (banner, header checkbox, release button)
 */
function updateSubmissionSelectionUI() {
  const totalSubmissions = state.currentGradingSubmissions.length;
  const selectedCount = state.selectedSubmissionIds.size;

  if (elements.teacherSelectedCount) {
    elements.teacherSelectedCount.textContent = selectedCount;
  }
  if (elements.teacherSelectedCountBanner) {
    elements.teacherSelectedCountBanner.style.display = selectedCount > 0 ? "inline" : "none";
  }

  // Header checkbox state (checked, indeterminate, unchecked)
  if (elements.teacherSelectAllSubmissions) {
    if (totalSubmissions === 0) {
      elements.teacherSelectAllSubmissions.checked = false;
      elements.teacherSelectAllSubmissions.indeterminate = false;
    } else if (selectedCount === totalSubmissions) {
      elements.teacherSelectAllSubmissions.checked = true;
      elements.teacherSelectAllSubmissions.indeterminate = false;
    } else if (selectedCount > 0) {
      elements.teacherSelectAllSubmissions.checked = false;
      elements.teacherSelectAllSubmissions.indeterminate = true;
    } else {
      elements.teacherSelectAllSubmissions.checked = false;
      elements.teacherSelectAllSubmissions.indeterminate = false;
    }
  }

  updateTeacherReleaseAllButton();
}

/**
 * Handles toggling all submissions via the table header checkbox
 */
function handleToggleSelectAllSubmissions(e) {
  const isChecked = e.target.checked;
  if (isChecked) {
    state.currentGradingSubmissions.forEach((s) => state.selectedSubmissionIds.add(s.id));
  } else {
    state.selectedSubmissionIds.clear();
  }

  if (elements.teacherSubmissionsTableBody) {
    elements.teacherSubmissionsTableBody.querySelectorAll(".sub-checkbox").forEach((cb) => {
      cb.checked = isChecked;
    });
  }

  updateSubmissionSelectionUI();
}

/**
 * Updates the 'Release All Graded' or 'Release Selected Graded' button state
 */
function updateTeacherReleaseAllButton() {
  if (!elements.teacherReleaseAllBtn) return;

  const isSelective = state.selectedSubmissionIds.size > 0;
  if (isSelective) {
    const selectedGraded = state.currentGradingSubmissions.filter(
      (s) => state.selectedSubmissionIds.has(s.id) && s.status === "graded"
    );
    elements.teacherReleaseAllBtn.style.display = "inline-flex";
    if (selectedGraded.length > 0) {
      elements.teacherReleaseAllBtn.disabled = false;
      elements.teacherReleaseAllBtn.textContent = `Release Selected Graded (${selectedGraded.length})`;
    } else {
      elements.teacherReleaseAllBtn.disabled = true;
      elements.teacherReleaseAllBtn.textContent = "Release Selected Graded (0)";
    }
  } else {
    const gradedDrafts = state.currentGradingSubmissions.filter((s) => s.status === "graded");
    elements.teacherReleaseAllBtn.disabled = false;
    elements.teacherReleaseAllBtn.style.display = gradedDrafts.length > 0 ? "inline-flex" : "none";
    elements.teacherReleaseAllBtn.innerHTML = `Release All Graded (<span id="teacherReleaseAllCount">${gradedDrafts.length}</span>)`;
  }
}

/**
 * Renders the teacher submissions roster table rows
 */
function renderTeacherSubmissionsRoster() {
  if (!elements.teacherSubmissionsTableBody) return;
  const assignment = state.currentGradingAssignment;
  const maxMarks = assignment && assignment.max_marks ? assignment.max_marks : 100;

  elements.teacherSubmissionsTableBody.innerHTML = state.currentGradingSubmissions
    .map((sub, idx) => {
      const isChecked = state.selectedSubmissionIds.has(sub.id);
      const lateBadge = sub.is_late
        ? `<span class="submission-pill status-late">Late</span>`
        : `<span class="submission-pill status-ontime">On Time</span>`;

      let statusBadge = `<span class="submission-pill status-ungraded">Ungraded</span>`;
      if (sub.status === "released") {
        statusBadge = `<span class="submission-pill status-released">Released</span>`;
      } else if (sub.status === "graded") {
        statusBadge = `<span class="submission-pill status-graded-draft">Graded (Draft)</span>`;
      }

      const gradeDisplay =
        sub.grade !== null && sub.grade !== undefined
          ? `<strong>${sub.grade}</strong> / ${maxMarks}`
          : `<span style="color: var(--text-muted);">— / ${maxMarks}</span>`;

      const downloadUrl =
        sub.download_url ||
        `${API_BASE}/api/assignments/${assignment.id}/submissions/${sub.id}/download`;

      const isPdf = (sub.file_name || "").toLowerCase().endsWith(".pdf");
      const isDocx = (sub.file_name || "").toLowerCase().endsWith(".docx");
      const previewTitle = isPdf ? "Preview PDF submission" : (isDocx ? "Preview DOCX submission" : "Preview submission");
      const previewBtn = `
        <button class="table-action-btn preview-btn roster-preview-btn" data-index="${idx}" type="button" title="${previewTitle}" aria-label="Preview submission" style="margin-right: 0.35rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      `;

      return `
        <tr>
          <td style="text-align: center;">
            <input type="checkbox" class="sub-checkbox" data-id="${sub.id}" ${isChecked ? "checked" : ""} aria-label="Select submission by ${escapeHtml(sub.student_name)}">
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(sub.student_name)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(sub.student_email)}</div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(sub.file_name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${formatBytes(sub.file_size)}</div>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">
            ${formatDisplayDateTime(sub.submitted_at)}
          </td>
          <td>
            ${lateBadge}
          </td>
          <td style="font-size: 0.875rem;">
            ${gradeDisplay}
          </td>
          <td>
            ${statusBadge}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-xs review-grade-btn" data-index="${idx}" type="button" style="margin-right: 0.4rem;">
              Review &amp; Grade
            </button>
            ${previewBtn}
            <a href="${downloadUrl}" target="_blank" rel="noopener" class="table-action-btn download-btn" download title="Download Submission (${escapeHtml(sub.file_name)})" aria-label="Download student submission">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach individual checkbox listeners
  elements.teacherSubmissionsTableBody.querySelectorAll(".sub-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const subId = parseInt(e.target.dataset.id, 10);
      if (e.target.checked) {
        state.selectedSubmissionIds.add(subId);
      } else {
        state.selectedSubmissionIds.delete(subId);
      }
      updateSubmissionSelectionUI();
    });
  });

  // Attach click listeners to "Review & Grade" buttons
  const reviewButtons = elements.teacherSubmissionsTableBody.querySelectorAll(".review-grade-btn");
  reviewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (!isNaN(idx)) {
        openGradingWorkspace(idx);
      }
    });
  });

  // Attach click listeners to Preview buttons in roster
  const rosterPreviewBtns = elements.teacherSubmissionsTableBody.querySelectorAll(".roster-preview-btn");
  rosterPreviewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (!isNaN(idx) && state.currentGradingSubmissions[idx]) {
        openSubmissionPreviewModal(state.currentGradingSubmissions[idx]);
      }
    });
  });

  updateSubmissionSelectionUI();
}

/**
 * Closes teacher submissions overview dialog
 */
function closeTeacherSubmissionsModal() {
  if (elements.teacherSubmissionsModalBackdrop) {
    elements.teacherSubmissionsModalBackdrop.style.display = "none";
  }
}

/**
 * Opens dedicated submission preview modal for student or teacher.
 * Handles in-browser PDF streaming or non-PDF download guidance.
 */
function openSubmissionPreviewModal(sub) {
  if (!sub) return;

  if (elements.submissionPreviewAlert) {
    elements.submissionPreviewAlert.style.display = "none";
    elements.submissionPreviewAlert.textContent = "";
  }

  const studentName = sub.student_name || state.currentUser?.full_name || "Student";
  const assignmentTitle = sub.assignment_title || (state.currentGradingAssignment?.title) || "Assignment";
  const className = sub.class_name ? ` • ${sub.class_name}` : (state.currentGradingAssignment?.class_name ? ` • ${state.currentGradingAssignment.class_name}` : "");

  if (elements.submissionPreviewSubtitle) {
    elements.submissionPreviewSubtitle.textContent = `${studentName} • ${assignmentTitle}${className}`;
  }

  const assignmentId = sub.assignment_id || state.currentGradingAssignment?.id;
  const downloadUrl = sub.download_url || `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/download`;
  const previewUrl = sub.preview_url || `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/preview`;

  if (elements.submissionPreviewDownloadTopBtn) {
    elements.submissionPreviewDownloadTopBtn.href = downloadUrl;
    elements.submissionPreviewDownloadTopBtn.setAttribute("download", sub.file_name || "submission");
  }

  const fileName = (sub.file_name || "").toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const isDocx = fileName.endsWith(".docx");

  if (isPdf) {
    if (elements.submissionPreviewFallback) elements.submissionPreviewFallback.style.display = "none";
    if (elements.submissionPreviewContainer) elements.submissionPreviewContainer.style.display = "flex";
    if (elements.submissionPreviewSpinner) {
      elements.submissionPreviewSpinner.style.display = "flex";
      const spText = elements.submissionPreviewSpinner.querySelector("p");
      if (spText) spText.textContent = "Loading document preview...";
    }

    if (elements.submissionPreviewIframe) {
      elements.submissionPreviewIframe.removeAttribute("srcdoc");
      elements.submissionPreviewIframe.onload = () => {
        if (elements.submissionPreviewSpinner) elements.submissionPreviewSpinner.style.display = "none";
      };
      elements.submissionPreviewIframe.onerror = () => {
        if (elements.submissionPreviewSpinner) elements.submissionPreviewSpinner.style.display = "none";
        if (elements.submissionPreviewAlert) {
          elements.submissionPreviewAlert.className = "auth-alert error";
          elements.submissionPreviewAlert.textContent = "Failed to load document preview. Please try downloading the file instead.";
          elements.submissionPreviewAlert.style.display = "block";
        }
      };
      elements.submissionPreviewIframe.src = previewUrl;
    }
  } else if (isDocx) {
    if (elements.submissionPreviewFallback) elements.submissionPreviewFallback.style.display = "none";
    if (elements.submissionPreviewContainer) elements.submissionPreviewContainer.style.display = "flex";
    if (elements.submissionPreviewSpinner) {
      elements.submissionPreviewSpinner.style.display = "flex";
      const spText = elements.submissionPreviewSpinner.querySelector("p");
      if (spText) spText.textContent = "Converting and loading document preview...";
    }

    if (elements.submissionPreviewIframe) {
      elements.submissionPreviewIframe.src = "about:blank";
      elements.submissionPreviewIframe.removeAttribute("srcdoc");
    }

    fetch(previewUrl, { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((html) => {
        if (elements.submissionPreviewSpinner) elements.submissionPreviewSpinner.style.display = "none";
        if (elements.submissionPreviewIframe) {
          elements.submissionPreviewIframe.srcdoc = html;
        }
      })
      .catch((err) => {
        console.error("DOCX modal preview error:", err);
        if (elements.submissionPreviewSpinner) elements.submissionPreviewSpinner.style.display = "none";
        if (elements.submissionPreviewContainer) elements.submissionPreviewContainer.style.display = "none";
        if (elements.submissionPreviewFallback) {
          elements.submissionPreviewFallback.style.display = "flex";
          if (elements.submissionPreviewFallbackFilename) elements.submissionPreviewFallbackFilename.textContent = sub.file_name;
          if (elements.submissionPreviewFallbackMeta) elements.submissionPreviewFallbackMeta.textContent = `Preview unavailable: ${err.message}`;
          if (elements.submissionPreviewFallbackDownloadBtn) {
            elements.submissionPreviewFallbackDownloadBtn.href = downloadUrl;
            elements.submissionPreviewFallbackDownloadBtn.setAttribute("download", sub.file_name || "submission");
          }
        }
        showToast(err.message || "Failed to preview DOCX.", "error");
      });
  } else {
    if (elements.submissionPreviewContainer) elements.submissionPreviewContainer.style.display = "none";
    if (elements.submissionPreviewSpinner) elements.submissionPreviewSpinner.style.display = "none";
    if (elements.submissionPreviewIframe) {
      elements.submissionPreviewIframe.src = "about:blank";
      elements.submissionPreviewIframe.removeAttribute("srcdoc");
    }
    if (elements.submissionPreviewFallback) elements.submissionPreviewFallback.style.display = "flex";

    if (elements.submissionPreviewFallbackFilename) {
      elements.submissionPreviewFallbackFilename.textContent = sub.file_name || "Submitted File";
    }
    if (elements.submissionPreviewFallbackMeta) {
      const ext = (sub.file_name || "").includes(".")
        ? sub.file_name.split(".").pop().toUpperCase()
        : "FILE";
      const sizeStr = sub.file_size ? formatBytes(sub.file_size) : "";
      elements.submissionPreviewFallbackMeta.textContent = sizeStr ? `${ext} Document • ${sizeStr}` : `${ext} Document`;
    }
    if (elements.submissionPreviewFallbackDownloadBtn) {
      elements.submissionPreviewFallbackDownloadBtn.href = downloadUrl;
      elements.submissionPreviewFallbackDownloadBtn.setAttribute("download", sub.file_name || "submission");
    }
  }

  if (elements.submissionPreviewModalBackdrop) {
    elements.submissionPreviewModalBackdrop.style.display = "flex";
  }
}

/**
 * Closes dedicated submission document preview modal
 */
function closeSubmissionPreviewModal() {
  if (elements.submissionPreviewModalBackdrop) {
    elements.submissionPreviewModalBackdrop.style.display = "none";
  }
  if (elements.submissionPreviewIframe) {
    elements.submissionPreviewIframe.src = "about:blank";
  }
  if (elements.submissionPreviewSpinner) {
    elements.submissionPreviewSpinner.style.display = "none";
  }
}

/**
 * Opens SpeedGrader workspace for submission at index
 */
function openGradingWorkspace(index) {
  if (index < 0 || index >= state.currentGradingSubmissions.length) return;
  state.currentGradingIndex = index;
  const assignment = state.currentGradingAssignment;
  const sub = state.currentGradingSubmissions[index];
  const maxMarks = assignment && assignment.max_marks ? assignment.max_marks : 100;

  // Title and subtitle
  if (elements.gradingWorkspaceSubtitle) {
    elements.gradingWorkspaceSubtitle.textContent = `${assignment.title} • ${assignment.class_name || assignment.subject || "General"}`;
  }

  // Counter
  if (elements.gradingStudentCounter) {
    elements.gradingStudentCounter.textContent = `Student ${index + 1} of ${state.currentGradingSubmissions.length}`;
  }

  // Navigation button states
  if (elements.gradingPrevStudentBtn) {
    elements.gradingPrevStudentBtn.disabled = index === 0;
  }
  if (elements.gradingNextStudentBtn) {
    elements.gradingNextStudentBtn.disabled = index === state.currentGradingSubmissions.length - 1;
  }

  // Clear alerts and errors
  hideGradingMarksError();
  if (elements.gradingWorkspaceAlert) {
    elements.gradingWorkspaceAlert.style.display = "none";
    elements.gradingWorkspaceAlert.textContent = "";
  }

  // Student details
  if (elements.gradingStudentName) {
    elements.gradingStudentName.textContent = sub.student_name;
  }
  if (elements.gradingStudentEmail) {
    elements.gradingStudentEmail.textContent = sub.student_email;
  }
  if (elements.gradingLateBadge) {
    if (sub.is_late) {
      elements.gradingLateBadge.className = "submission-pill status-late";
      elements.gradingLateBadge.textContent = "Late";
    } else {
      elements.gradingLateBadge.className = "submission-pill status-ontime";
      elements.gradingLateBadge.textContent = "On Time";
    }
  }
  if (elements.gradingSubmittedAt) {
    elements.gradingSubmittedAt.textContent = formatDisplayDateTime(sub.submitted_at);
  }
  if (elements.gradingStudentNotes) {
    elements.gradingStudentNotes.textContent = sub.notes ? sub.notes : "—";
  }

  // Status badge
  updateWorkspaceStatusBadge(sub.status);

  // Marks and max marks
  if (elements.gradingMaxMarksLabel) {
    elements.gradingMaxMarksLabel.textContent = maxMarks;
  }
  if (elements.gradingMarksInput) {
    elements.gradingMarksInput.max = maxMarks;
    elements.gradingMarksInput.value =
      sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
  }
  if (elements.gradingFeedbackInput) {
    elements.gradingFeedbackInput.value = sub.feedback || "";
  }

  // Preview Handling: PDF vs Fallback
  const assignmentId = (assignment && assignment.id) || sub.assignment_id;
  const previewUrl =
    sub.preview_url ||
    `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/preview`;
  const downloadUrl =
    sub.download_url ||
    `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/download`;

  // Fallback Download button in SpeedGrader header
  if (elements.gradingDownloadBtn) {
    elements.gradingDownloadBtn.href = downloadUrl;
    elements.gradingDownloadBtn.setAttribute("download", sub.file_name || "submission");
  }

  const fileName = (sub.file_name || "").toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const isDocx = fileName.endsWith(".docx");

  if (isPdf) {
    if (elements.gradingNonPdfFallback) elements.gradingNonPdfFallback.style.display = "none";
    if (elements.gradingPdfContainer) elements.gradingPdfContainer.style.display = "block";
    if (elements.gradingPdfSpinner) {
      elements.gradingPdfSpinner.style.display = "flex";
      const spText = elements.gradingPdfSpinner.querySelector("p");
      if (spText) spText.textContent = "Loading document preview...";
    }

    if (elements.gradingPdfIframe) {
      elements.gradingPdfIframe.removeAttribute("srcdoc");
      elements.gradingPdfIframe.onload = () => {
        if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
      };
      elements.gradingPdfIframe.onerror = () => {
        if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
      };
      elements.gradingPdfIframe.src = previewUrl;
    }
  } else if (isDocx) {
    if (elements.gradingNonPdfFallback) elements.gradingNonPdfFallback.style.display = "none";
    if (elements.gradingPdfContainer) elements.gradingPdfContainer.style.display = "block";
    if (elements.gradingPdfSpinner) {
      elements.gradingPdfSpinner.style.display = "flex";
      const spText = elements.gradingPdfSpinner.querySelector("p");
      if (spText) spText.textContent = "Converting and loading document preview...";
    }

    if (elements.gradingPdfIframe) {
      elements.gradingPdfIframe.src = "about:blank";
      elements.gradingPdfIframe.removeAttribute("srcdoc");
    }

    fetch(previewUrl, { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((html) => {
        if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
        if (elements.gradingPdfIframe) {
          elements.gradingPdfIframe.srcdoc = html;
        }
      })
      .catch((err) => {
        console.error("DOCX SpeedGrader preview error:", err);
        if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
        if (elements.gradingPdfContainer) elements.gradingPdfContainer.style.display = "none";
        if (elements.gradingNonPdfFallback) {
          elements.gradingNonPdfFallback.style.display = "flex";
          if (elements.gradingNonPdfFilename) elements.gradingNonPdfFilename.textContent = sub.file_name;
          if (elements.gradingNonPdfMeta) elements.gradingNonPdfMeta.textContent = `Preview unavailable: ${err.message}`;
          if (elements.gradingNonPdfDownloadBtn) {
            elements.gradingNonPdfDownloadBtn.href = downloadUrl;
            elements.gradingNonPdfDownloadBtn.setAttribute("download", sub.file_name || "submission");
          }
        }
        showToast(err.message || "Failed to preview DOCX.", "error");
      });
  } else {
    if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
    if (elements.gradingPdfContainer) elements.gradingPdfContainer.style.display = "none";
    if (elements.gradingPdfIframe) {
      elements.gradingPdfIframe.src = "about:blank";
      elements.gradingPdfIframe.removeAttribute("srcdoc");
    }
    if (elements.gradingNonPdfFallback) elements.gradingNonPdfFallback.style.display = "flex";
    if (elements.gradingNonPdfFilename) elements.gradingNonPdfFilename.textContent = sub.file_name;
    if (elements.gradingNonPdfMeta) {
      const ext = sub.file_name.includes(".")
        ? sub.file_name.split(".").pop().toUpperCase()
        : "FILE";
      elements.gradingNonPdfMeta.textContent = `${ext} Document • ${formatBytes(sub.file_size)}`;
    }
    if (elements.gradingNonPdfDownloadBtn) {
      elements.gradingNonPdfDownloadBtn.href = downloadUrl;
      elements.gradingNonPdfDownloadBtn.setAttribute("download", sub.file_name || "submission");
    }
  }

  // Release single button appearance
  if (elements.gradingReleaseSingleBtn) {
    if (sub.status === "released") {
      elements.gradingReleaseSingleBtn.textContent = "Grade Released";
      elements.gradingReleaseSingleBtn.disabled = true;
    } else {
      elements.gradingReleaseSingleBtn.textContent = "Release Grade to Student";
      elements.gradingReleaseSingleBtn.disabled = false;
    }
  }

  // Show Workspace Modal
  if (elements.gradingWorkspaceModalBackdrop) {
    elements.gradingWorkspaceModalBackdrop.style.display = "flex";
  }
}

/**
 * Updates status badge in SpeedGrader workspace
 */
function updateWorkspaceStatusBadge(status) {
  if (!elements.gradingStatusBadge) return;
  if (status === "released") {
    elements.gradingStatusBadge.className = "submission-pill status-released";
    elements.gradingStatusBadge.textContent = "Released";
  } else if (status === "graded") {
    elements.gradingStatusBadge.className = "submission-pill status-graded-draft";
    elements.gradingStatusBadge.textContent = "Graded (Draft)";
  } else {
    elements.gradingStatusBadge.className = "submission-pill status-ungraded";
    elements.gradingStatusBadge.textContent = "Ungraded";
  }
}

/**
 * Closes SpeedGrader workspace modal
 */
function closeGradingWorkspaceModal() {
  if (elements.gradingWorkspaceModalBackdrop) {
    elements.gradingWorkspaceModalBackdrop.style.display = "none";
  }
  if (elements.gradingPdfIframe) {
    elements.gradingPdfIframe.src = "about:blank";
  }
  if (elements.gradingPdfSpinner) {
    elements.gradingPdfSpinner.style.display = "none";
  }
  renderTeacherSubmissionsRoster();
  updateTeacherReleaseAllButton();
}

/**
 * Navigates to previous or next student in SpeedGrader
 */
function navigateGradingWorkspace(direction) {
  const newIndex = state.currentGradingIndex + direction;
  if (newIndex >= 0 && newIndex < state.currentGradingSubmissions.length) {
    openGradingWorkspace(newIndex);
  }
}

/**
 * Shows error message on marks input
 */
function showGradingMarksError(message) {
  if (elements.gradingMarksError) {
    elements.gradingMarksError.textContent = message;
    elements.gradingMarksError.style.display = "block";
  }
}

/**
 * Hides error message on marks input
 */
function hideGradingMarksError() {
  if (elements.gradingMarksError) {
    elements.gradingMarksError.textContent = "";
    elements.gradingMarksError.style.display = "none";
  }
}

/**
 * Sets button busy state during grading save/release
 */
function setGradingActionButtonsBusy(busy, action = "") {
  if (elements.gradingSaveDraftBtn) {
    elements.gradingSaveDraftBtn.disabled = busy;
    elements.gradingSaveDraftBtn.textContent = busy && action === "draft" ? "Saving..." : "Save Draft";
  }
  if (elements.gradingSaveNextBtn) {
    elements.gradingSaveNextBtn.disabled = busy;
    elements.gradingSaveNextBtn.textContent = busy && action === "next" ? "Saving..." : "Save & Next ›";
  }
  if (elements.gradingReleaseSingleBtn) {
    const currentSub = state.currentGradingSubmissions && state.currentGradingSubmissions[state.currentGradingIndex];
    if (busy) {
      elements.gradingReleaseSingleBtn.disabled = true;
    } else if (currentSub && currentSub.status === "released") {
      elements.gradingReleaseSingleBtn.disabled = true;
      elements.gradingReleaseSingleBtn.textContent = "Grade Released";
    } else {
      elements.gradingReleaseSingleBtn.disabled = false;
      elements.gradingReleaseSingleBtn.textContent = "Release Grade to Student";
    }
  }
}

/**
 * Saves draft grade and feedback without releasing
 */
async function saveGrade(advanceNext = false) {
  if (state.isGradingSaving) return;

  const assignment = state.currentGradingAssignment;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  if (!assignment || !sub) return;

  const maxMarks = assignment.max_marks || 100;
  const marksStr = elements.gradingMarksInput ? elements.gradingMarksInput.value.trim() : "";

  if (marksStr === "") {
    showGradingMarksError("Marks value is required.");
    if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
    return;
  }

  const marks = parseFloat(marksStr);
  if (isNaN(marks)) {
    showGradingMarksError("Please enter a valid numeric mark.");
    if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
    return;
  }

  if (marks < 0) {
    showGradingMarksError("Marks cannot be negative.");
    if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
    return;
  }

  if (marks > maxMarks) {
    showGradingMarksError(`Marks cannot exceed maximum marks (${maxMarks}).`);
    if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
    return;
  }

  hideGradingMarksError();
  const feedback = elements.gradingFeedbackInput ? elements.gradingFeedbackInput.value.trim() : "";

  state.isGradingSaving = true;
  setGradingActionButtonsBusy(true, advanceNext ? "next" : "draft");

  if (elements.gradingWorkspaceAlert) {
    elements.gradingWorkspaceAlert.style.display = "none";
    elements.gradingWorkspaceAlert.textContent = "";
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions/${sub.id}/grade`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grade: marks,
        feedback: feedback.length > 0 ? feedback : null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      let errMsg = `Failed to save grade (HTTP ${res.status})`;
      if (err.detail) {
        if (Array.isArray(err.detail)) {
          errMsg = err.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          errMsg = err.detail;
        }
      }
      throw new Error(errMsg);
    }

    const updated = await res.json();
    state.currentGradingSubmissions[state.currentGradingIndex] = {
      ...sub,
      ...updated,
    };

    updateWorkspaceStatusBadge(updated.status);
    updateTeacherReleaseAllButton();
    renderTeacherSubmissionsRoster();

    showToast(`Draft grade saved for ${sub.student_name}.`, "success");

    if (advanceNext) {
      if (state.currentGradingIndex < state.currentGradingSubmissions.length - 1) {
        openGradingWorkspace(state.currentGradingIndex + 1);
      } else {
        showToast("Saved. You have reached the last submission in this roster.", "info");
      }
    }
  } catch (err) {
    console.error("Save grade error:", err);
    if (elements.gradingWorkspaceAlert) {
      elements.gradingWorkspaceAlert.textContent = err.message || "Failed to save draft grade.";
      elements.gradingWorkspaceAlert.style.display = "block";
    }
    showToast(err.message || "Failed to save draft grade.", "error");
  } finally {
    state.isGradingSaving = false;
    setGradingActionButtonsBusy(false);
  }
}

/**
 * Opens confirmation modal for releasing a single student's grade
 */
function openSingleReleaseModal() {
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  if (!sub) return;

  if (sub.status === "released") {
    showToast("This grade is already released to the student.", "info");
    return;
  }

  const marksInput = elements.gradingMarksInput ? elements.gradingMarksInput.value.trim() : "";
  if (sub.grade === null || sub.grade === undefined) {
    if (!marksInput) {
      showToast("Please save a draft grade before releasing.", "error");
      if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
      return;
    }
  }

  state.pendingSingleReleaseSubId = sub.id;
  const displayScore = sub.grade !== null && sub.grade !== undefined ? sub.grade : marksInput;
  if (elements.singleReleaseConfirmMessage) {
    elements.singleReleaseConfirmMessage.innerHTML = `Are you sure you want to release the grade for <strong>${escapeHtml(sub.student_name)}</strong>?<br><br>The student will immediately see their score (${displayScore} marks) and feedback.`;
  }
  if (elements.singleReleaseConfirmBackdrop) {
    elements.singleReleaseConfirmBackdrop.style.display = "flex";
  }
}

/**
 * Closes single release confirmation modal
 */
function closeSingleReleaseModal() {
  if (elements.singleReleaseConfirmBackdrop) {
    elements.singleReleaseConfirmBackdrop.style.display = "none";
  }
  state.pendingSingleReleaseSubId = null;
}

/**
 * Confirms single grade release via API
 */
async function confirmSingleRelease(targetSubId = null) {
  const currentSub = state.currentGradingSubmissions && state.currentGradingSubmissions[state.currentGradingIndex];
  const subId = targetSubId || state.pendingSingleReleaseSubId || (currentSub && currentSub.id);
  const assignment = state.currentGradingAssignment;
  const assignmentId = (assignment && assignment.id) || (currentSub && currentSub.assignment_id);

  if (!subId || !assignmentId) {
    console.error("Missing ID for grade release:", { subId, assignmentId });
    showToast("Unable to release grade: missing assignment or submission ID.", "error");
    return;
  }

  const sub = state.currentGradingSubmissions.find((s) => s.id === subId) || currentSub;
  if (!sub) {
    showToast("Submission not found in roster.", "error");
    return;
  }

  if (sub.status === "released") {
    showToast("This grade is already released to the student.", "info");
    if (elements.gradingReleaseSingleBtn) {
      elements.gradingReleaseSingleBtn.textContent = "Grade Released";
      elements.gradingReleaseSingleBtn.disabled = true;
    }
    return;
  }

  // Check if marks are entered in the input fields
  const marksInput = elements.gradingMarksInput ? elements.gradingMarksInput.value.trim() : "";
  const feedbackInput = elements.gradingFeedbackInput ? elements.gradingFeedbackInput.value.trim() : "";

  if (sub.grade === null || sub.grade === undefined) {
    if (!marksInput) {
      showToast("Cannot release ungraded submission. Please enter marks first.", "error");
      if (elements.gradingMarksInput) elements.gradingMarksInput.focus();
      return;
    }
  }

  // If marks or feedback was edited in the input fields, auto-save draft first
  const parsedMarks = parseFloat(marksInput);
  if (!isNaN(parsedMarks) && (sub.grade !== parsedMarks || (sub.feedback || "") !== feedbackInput)) {
    try {
      if (elements.gradingReleaseSingleBtn) {
        elements.gradingReleaseSingleBtn.disabled = true;
        elements.gradingReleaseSingleBtn.textContent = "Saving Draft...";
      }
      const draftRes = await fetch(`${API_ENDPOINTS.assignments}/${assignmentId}/submissions/${subId}/grade`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grade: parsedMarks,
          feedback: feedbackInput.length > 0 ? feedbackInput : null,
        }),
      });
      if (!draftRes.ok) {
        const errJson = await draftRes.json().catch(() => ({}));
        let errDetail = "Failed to save draft before release.";
        if (errJson.detail) {
          errDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
        throw new Error(errDetail);
      }
      const savedSub = await draftRes.json();
      sub.grade = savedSub.grade;
      sub.feedback = savedSub.feedback;
      sub.status = savedSub.status;
    } catch (saveErr) {
      console.error("Auto-save draft error before release:", saveErr);
      if (elements.gradingReleaseSingleBtn) {
        elements.gradingReleaseSingleBtn.disabled = false;
        elements.gradingReleaseSingleBtn.textContent = "Release Grade to Student";
      }
      showToast(saveErr.message || "Failed to save draft grade before release.", "error");
      return;
    }
  }

  // Set releasing UI state
  if (elements.gradingReleaseSingleBtn) {
    elements.gradingReleaseSingleBtn.disabled = true;
    elements.gradingReleaseSingleBtn.textContent = "Releasing...";
  }
  if (elements.confirmSingleReleaseBtn) {
    elements.confirmSingleReleaseBtn.disabled = true;
    elements.confirmSingleReleaseBtn.textContent = "Releasing...";
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignmentId}/submissions/${subId}/release`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      let errMsg = `Failed to release grade (HTTP ${res.status})`;
      if (err.detail) {
        errMsg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
      }
      throw new Error(errMsg);
    }

    const updated = await res.json();
    const idx = state.currentGradingSubmissions.findIndex((s) => s.id === subId);
    if (idx !== -1) {
      state.currentGradingSubmissions[idx] = {
        ...state.currentGradingSubmissions[idx],
        ...updated,
      };
    }

    closeSingleReleaseModal();
    updateWorkspaceStatusBadge("released");
    if (elements.gradingReleaseSingleBtn) {
      elements.gradingReleaseSingleBtn.textContent = "Grade Released";
      elements.gradingReleaseSingleBtn.disabled = true;
    }
    updateTeacherReleaseAllButton();
    renderTeacherSubmissionsRoster();

    showToast("Grade released successfully to the student!", "success");
  } catch (err) {
    console.error("Release grade error:", err);
    if (elements.gradingReleaseSingleBtn) {
      elements.gradingReleaseSingleBtn.disabled = false;
      elements.gradingReleaseSingleBtn.textContent = "Release Grade to Student";
    }
    showToast(err.message || "Failed to release grade.", "error");
  } finally {
    if (elements.confirmSingleReleaseBtn) {
      elements.confirmSingleReleaseBtn.disabled = false;
      elements.confirmSingleReleaseBtn.textContent = "Yes, Release Grade";
    }
  }
}

/**
 * Opens bulk release confirmation modal (supports all graded or selected graded)
 */
function openBulkReleaseModal() {
  const isSelective = state.selectedSubmissionIds.size > 0;
  const targetSubs = isSelective
    ? state.currentGradingSubmissions.filter((s) => state.selectedSubmissionIds.has(s.id) && s.status === "graded")
    : state.currentGradingSubmissions.filter((s) => s.status === "graded");

  if (targetSubs.length === 0) {
    if (isSelective) {
      showToast("None of the selected submissions have draft grades ready to release.", "info");
    } else {
      showToast("No graded (draft) submissions available to release.", "info");
    }
    return;
  }

  if (elements.bulkReleaseConfirmTitle) {
    elements.bulkReleaseConfirmTitle.textContent = isSelective
      ? "Release Selected Graded Submissions"
      : "Release All Graded Submissions";
  }

  if (elements.bulkReleaseConfirmMessage) {
    elements.bulkReleaseConfirmMessage.innerHTML = isSelective
      ? `
        Are you sure you want to release grades for <strong>${targetSubs.length}</strong> selected graded submission(s)?
        <br><br>
        <span style="font-size: 0.85rem; color: var(--text-muted);">
          Only selected submissions with draft grades will be released. Ungraded submissions will remain unreleased.
        </span>
      `
      : `
        Are you sure you want to release grades for <strong>${targetSubs.length}</strong> graded submission(s)?
        <br><br>
        <span style="font-size: 0.85rem; color: var(--text-muted);">
          All graded students will immediately see their scores and feedback. Ungraded submissions will remain unreleased.
        </span>
      `;
  }

  if (elements.confirmBulkReleaseBtn) {
    elements.confirmBulkReleaseBtn.textContent = isSelective
      ? `Yes, Release Selected (${targetSubs.length})`
      : `Yes, Release All Graded (${targetSubs.length})`;
  }

  if (elements.bulkReleaseConfirmBackdrop) {
    elements.bulkReleaseConfirmBackdrop.style.display = "flex";
  }
}

/**
 * Closes bulk release confirmation modal
 */
function closeBulkReleaseModal() {
  if (elements.bulkReleaseConfirmBackdrop) {
    elements.bulkReleaseConfirmBackdrop.style.display = "none";
  }
}

/**
 * Confirms bulk release of graded submissions via API (selective or all)
 */
async function confirmBulkRelease() {
  const assignment = state.currentGradingAssignment;
  if (!assignment) return;

  const isSelective = state.selectedSubmissionIds.size > 0;
  const payload = isSelective
    ? { submission_ids: Array.from(state.selectedSubmissionIds) }
    : null;

  if (elements.confirmBulkReleaseBtn) {
    elements.confirmBulkReleaseBtn.disabled = true;
    elements.confirmBulkReleaseBtn.textContent = "Releasing...";
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/release-grades`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Mark affected submissions as released
    const releasedIds = new Set(
      isSelective
        ? state.currentGradingSubmissions
            .filter((s) => state.selectedSubmissionIds.has(s.id) && s.status === "graded")
            .map((s) => s.id)
        : state.currentGradingSubmissions
            .filter((s) => s.status === "graded")
            .map((s) => s.id)
    );

    state.currentGradingSubmissions = state.currentGradingSubmissions.map((s) => {
      if (releasedIds.has(s.id)) {
        return { ...s, status: "released" };
      }
      return s;
    });

    state.selectedSubmissionIds.clear();

    closeBulkReleaseModal();
    updateSubmissionSelectionUI();
    renderTeacherSubmissionsRoster();

    // Update SpeedGrader if currently open on a released submission
    const currentSub = state.currentGradingSubmissions[state.currentGradingIndex];
    if (currentSub && currentSub.status === "released") {
      updateWorkspaceStatusBadge("released");
      if (elements.gradingReleaseSingleBtn) {
        elements.gradingReleaseSingleBtn.textContent = "Grade Released";
        elements.gradingReleaseSingleBtn.disabled = true;
      }
    }

    showToast(`Successfully released grades for ${data.released_count || 0} student(s)!`, "success");
  } catch (err) {
    console.error("Bulk release error:", err);
    showToast(err.message || "Failed to release grades.", "error");
  } finally {
    if (elements.confirmBulkReleaseBtn) {
      elements.confirmBulkReleaseBtn.disabled = false;
      elements.confirmBulkReleaseBtn.textContent = "Yes, Release All Graded";
    }
  }
}

/**
 * Triggers browser download of file from response blob
 */
function triggerFileDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 100);
}

/**
 * Handles exporting assignment submissions summary to CSV
 */
async function handleExportCsv() {
  const assignment = state.currentGradingAssignment;
  if (!assignment) return;

  const btn = elements.teacherExportCsvBtn;
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:0.35rem;"></span> Exporting...`;
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/export/csv`, {
      method: "GET",
      credentials: "same-origin",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Export failed with HTTP ${res.status}`);
    }

    let filename = `${assignment.title || "assignment"}_submissions.csv`;
    const disposition = res.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    triggerFileDownload(blob, filename);
    showToast("CSV export downloaded successfully!", "success");
  } catch (err) {
    console.error("CSV export error:", err);
    showToast(err.message || "Failed to export CSV.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

/**
 * Handles downloading all student submissions as a ZIP archive
 */
async function handleDownloadZip() {
  const assignment = state.currentGradingAssignment;
  if (!assignment) return;

  const btn = elements.teacherDownloadZipBtn;
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:0.35rem;"></span> Preparing ZIP...`;
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/export/zip`, {
      method: "GET",
      credentials: "same-origin",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Download failed with HTTP ${res.status}`);
    }

    let filename = `${assignment.title || "assignment"}_submissions.zip`;
    const disposition = res.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    triggerFileDownload(blob, filename);
    showToast("Submissions ZIP downloaded successfully!", "success");
  } catch (err) {
    console.error("ZIP download error:", err);
    showToast(err.message || "Failed to download ZIP.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}



