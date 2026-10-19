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
  semesters: `${API_BASE}/api/semesters`,
};

// Application State
const state = {
  currentUser: null,
  assignments: [],
  filteredAssignments: [],
  classes: [],
  semesters: [],
  activeSemesterId: null,
  activeSemester: null,
  activeSubjectId: null,
  activeSubjectTab: "assignments",
  drawerContext: null,
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
  semestersView: document.getElementById("semestersView"),
  assignmentsView: document.getElementById("assignmentsView"),
  classesView: document.getElementById("classesView"),
  submissionsView: document.getElementById("submissionsView"),
  reportsView: document.getElementById("reportsView"),
  calendarView: document.getElementById("calendarView"),
  analyticsView: document.getElementById("analyticsView"),
  settingsView: document.getElementById("settingsView"),

  // Semesters Page Elements
  semestersListContainer: document.getElementById("semestersListContainer"),
  btnOpenCreateSemester: document.getElementById("btnOpenCreateSemester"),
  createSemesterInlineForm: document.getElementById("createSemesterInlineForm"),
  newSemName: document.getElementById("newSemName"),
  newSemYear: document.getElementById("newSemYear"),
  newSemStartDate: document.getElementById("newSemStartDate"),
  newSemEndDate: document.getElementById("newSemEndDate"),
  btnCancelCreateSemester: document.getElementById("btnCancelCreateSemester"),

  // Reports Page Elements
  reportBreadcrumbCurrent: document.getElementById("reportBreadcrumbCurrent"),
  reportTitle: document.getElementById("reportTitle"),
  reportSubtitle: document.getElementById("reportSubtitle"),
  btnExportSemesterCsv: document.getElementById("btnExportSemesterCsv"),
  btnExportSemesterPdf: document.getElementById("btnExportSemesterPdf"),
  btnFinalizeSemesterReport: document.getElementById("btnFinalizeSemesterReport"),
  reportStatusBanner: document.getElementById("reportStatusBanner"),
  reportMetricsRow: document.getElementById("reportMetricsRow"),
  reportSubjectChartContainer: document.getElementById("reportSubjectChartContainer"),
  reportTopStudentsTbody: document.getElementById("reportTopStudentsTbody"),

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
  dashMidCenterCard: document.getElementById("dashMidCenterCard"),
  dashMidRightCard: document.getElementById("dashMidRightCard"),
  dashBottomLeftCard: document.getElementById("dashBottomLeftCard"),
  dashBottomCenterCard: document.getElementById("dashBottomCenterCard"),
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
  formSemesterId: document.getElementById("formSemesterId"),
  formSemesterDisplay: document.getElementById("formSemesterDisplay"),
  formSemesterGroup: document.getElementById("formSemesterGroup"),
  classLockIcon: document.getElementById("classLockIcon"),
  semesterLockIcon: document.getElementById("semesterLockIcon"),
  subjectLockIcon: document.getElementById("subjectLockIcon"),
  drawerSubtitle: document.getElementById("drawerSubtitle"),
  formTitle: document.getElementById("formTitle"),
  formUnit: document.getElementById("formUnit"),
  formSubject: document.getElementById("formSubject"),
  formCustomSubject: document.getElementById("formCustomSubject"),
  customSubjectGroup: document.getElementById("customSubjectGroup"),
  formDescription: document.getElementById("formDescription"),
  formMaxMarks: document.getElementById("formMaxMarks"),
  formPdf: document.getElementById("formPdf"),
  fileDropzone: document.getElementById("fileDropzone"),
  dropzoneText: document.getElementById("dropzoneText"),
  selectedFileCard: document.getElementById("selectedFileCard"),
  selectedFileName: document.getElementById("selectedFileName"),
  selectedFileSize: document.getElementById("selectedFileSize"),
  removeAttachmentBtn: document.getElementById("removeAttachmentBtn"),
  currentAttachmentBox: document.getElementById("currentAttachmentBox"),
  currentAttachmentName: document.getElementById("currentAttachmentName"),
  pdfRequiredStar: document.getElementById("pdfRequiredStar"),
  pdfError: document.getElementById("pdfError"),
  formDueDate: document.getElementById("formDueDate"),
  formStatus: document.getElementById("formStatus"),
  drawerDraftBtn: document.getElementById("drawerDraftBtn"),
  titleError: document.getElementById("titleError"),
  subjectError: document.getElementById("subjectError"),
  classError: document.getElementById("classError"),
  maxMarksError: document.getElementById("maxMarksError"),
  descriptionError: document.getElementById("descriptionError"),
  dueDateError: document.getElementById("dueDateError"),
  dueDateTzLabel: document.getElementById("dueDateTzLabel"),
  subjectEmptyState: document.getElementById("subjectEmptyState"),
  btnDrawerAddSubject: document.getElementById("btnDrawerAddSubject"),

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

  // SpeedGrader Workflow Sub-Modals (Audit Correct, History, Resubmission)
  gradingAuditCorrectBtn: document.getElementById("gradingAuditCorrectBtn"),
  gradingSubmissionHistoryBtn: document.getElementById("gradingSubmissionHistoryBtn"),
  gradingAuthorizeResubmissionBtn: document.getElementById("gradingAuthorizeResubmissionBtn"),

  auditCorrectModalBackdrop: document.getElementById("auditCorrectModalBackdrop"),
  closeAuditCorrectModalBtn: document.getElementById("closeAuditCorrectModalBtn"),
  cancelAuditCorrectBtn: document.getElementById("cancelAuditCorrectBtn"),
  confirmAuditCorrectBtn: document.getElementById("confirmAuditCorrectBtn"),
  auditCurrentGradeVal: document.getElementById("auditCurrentGradeVal"),
  auditCurrentMaxMarks: document.getElementById("auditCurrentMaxMarks"),
  auditNewGradeInput: document.getElementById("auditNewGradeInput"),
  auditNewGradeMaxLabel: document.getElementById("auditNewGradeMaxLabel"),
  auditReasonInput: document.getElementById("auditReasonInput"),
  auditGradeError: document.getElementById("auditGradeError"),
  auditReasonError: document.getElementById("auditReasonError"),

  submissionHistoryModalBackdrop: document.getElementById("submissionHistoryModalBackdrop"),
  closeSubmissionHistoryModalBtn: document.getElementById("closeSubmissionHistoryModalBtn"),
  closeSubmissionHistoryBottomBtn: document.getElementById("closeSubmissionHistoryBottomBtn"),
  historyStudentMeta: document.getElementById("historyStudentMeta"),
  historyAttemptsList: document.getElementById("historyAttemptsList"),

  authorizeResubmissionModalBackdrop: document.getElementById("authorizeResubmissionModalBackdrop"),
  closeAuthorizeResubmissionModalBtn: document.getElementById("closeAuthorizeResubmissionModalBtn"),
  cancelAuthorizeResubmissionBtn: document.getElementById("cancelAuthorizeResubmissionBtn"),
  confirmAuthorizeResubmissionBtn: document.getElementById("confirmAuthorizeResubmissionBtn"),
  authorizeResubmissionMessage: document.getElementById("authorizeResubmissionMessage"),
  resubmissionNotesInput: document.getElementById("resubmissionNotesInput"),

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
    const rawHash = (window.location.hash || "").replace(/^#\/?/, "");
    const subjectMatch = rawHash.match(/^(?:classes|subjects)\/(\d+)/i);
    if (subjectMatch) {
      viewSubjectDetail(parseInt(subjectMatch[1], 10));
      return;
    }
    const route = rawHash.toLowerCase() || "dashboard";
    navigateToView(route, false);
  });

  // Nav item click interaction (Top navigation bar and drawer)
  document.querySelectorAll(".nav-link").forEach((link) => {
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

  // Mobile Hamburger Menu Toggle Button
  if (elements.menuToggleBtn) {
    elements.menuToggleBtn.addEventListener("click", () => {
      openSidebar();
    });
  }

  // Mobile Sidebar Close Button
  if (elements.sidebarCloseBtn) {
    elements.sidebarCloseBtn.addEventListener("click", () => {
      closeSidebar();
    });
  }

  // Sidebar Backdrop Click to Dismiss
  if (elements.sidebarBackdrop) {
    elements.sidebarBackdrop.addEventListener("click", () => {
      closeSidebar();
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

  // Class selection change listener
  if (elements.formClass) {
    elements.formClass.addEventListener("change", async (e) => {
      if (elements.classError) elements.classError.textContent = "";
      if (elements.subjectError) elements.subjectError.textContent = "";

      // Immediately clear previously selected subject and dynamic options
      if (elements.formSubject) {
        elements.formSubject.value = "";
        const dynamicOpts = elements.formSubject.querySelectorAll(".dynamic-subject-opt");
        dynamicOpts.forEach((opt) => opt.remove());
      }
      setFormSubjectValue("");

      const selectedClassId = parseInt(e.target.value, 10);
      const foundClass = (state.classes || []).find((c) => c.id === selectedClassId);
      if (foundClass && foundClass.semester_id) {
        const semDisplay = getSemesterDisplayName(foundClass.semester_id, foundClass);
        if (elements.formSemesterId) elements.formSemesterId.value = String(foundClass.semester_id);
        if (elements.formSemesterDisplay) elements.formSemesterDisplay.value = semDisplay || "Semester";
        if (elements.semesterLockIcon) elements.semesterLockIcon.style.display = "flex";
        setFormSubjectValue(foundClass.name);
        state.drawerContext = {
          type: "semester_subject",
          classId: foundClass.id,
          className: foundClass.name,
          subjectId: foundClass.id,
          subjectName: foundClass.name,
          semesterId: foundClass.semester_id,
          isSubjectLocked: false,
        };
        await loadClassSubjects(foundClass.id, foundClass.name);
      } else if (!selectedClassId) {
        if (!state.activeSubjectId) {
          if (elements.formSemesterId) elements.formSemesterId.value = "";
          if (elements.formSemesterDisplay) elements.formSemesterDisplay.value = "";
          if (elements.semesterLockIcon) elements.semesterLockIcon.style.display = "none";
          state.drawerContext = null;
        }
        await loadClassSubjects(null);
      } else if (foundClass) {
        if (elements.formSemesterId) elements.formSemesterId.value = "";
        if (elements.formSemesterDisplay) elements.formSemesterDisplay.value = "None (Independent Class)";
        if (elements.semesterLockIcon) elements.semesterLockIcon.style.display = "none";
        state.drawerContext = {
          type: "class",
          classId: foundClass.id,
          className: foundClass.name,
          subjectId: foundClass.id,
          subjectName: null,
          semesterId: null,
          isSubjectLocked: false,
        };
        await loadClassSubjects(foundClass.id);
      }
    });
  }

  // Drawer Add Subject button listener for empty states
  if (elements.btnDrawerAddSubject) {
    elements.btnDrawerAddSubject.addEventListener("click", async () => {
      const selectedClassId = elements.formClass ? parseInt(elements.formClass.value, 10) : null;
      if (!selectedClassId) {
        showToast("Please select a class first to add subjects.", "error");
        return;
      }
      const newSubjectName = prompt("Enter new subject name for this class:");
      if (!newSubjectName || !newSubjectName.trim()) return;

      try {
        const res = await fetch(`${API_ENDPOINTS.classes}/${selectedClassId}/subjects`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ name: newSubjectName.trim() }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to add subject");
        }

        const createdSub = await res.json();
        showToast(`Subject "${createdSub.name}" added successfully!`, "success");
        await loadClassSubjects(selectedClassId, createdSub.name, createdSub.id);
      } catch (err) {
        console.error("Add subject error:", err);
        showToast(err.message || "Failed to add subject", "error");
      }
    });
  }

  // Action buttons: Save as Draft vs Publish Assignment
  if (elements.drawerDraftBtn) {
    elements.drawerDraftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      elements.formStatus.value = "draft";
      elements.assignmentForm.requestSubmit();
    });
  }

  if (elements.drawerSubmitBtn) {
    elements.drawerSubmitBtn.addEventListener("click", () => {
      elements.formStatus.value = "active";
    });
  }

  // Remove selected question PDF attachment
  if (elements.removeAttachmentBtn) {
    elements.removeAttachmentBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeSelectedFile();
    });
  }

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

  // SpeedGrader Workflow Sub-Modal Listeners
  if (elements.gradingAuditCorrectBtn) {
    elements.gradingAuditCorrectBtn.addEventListener("click", openAuditCorrectModal);
  }
  if (elements.closeAuditCorrectModalBtn) {
    elements.closeAuditCorrectModalBtn.addEventListener("click", closeAuditCorrectModal);
  }
  if (elements.cancelAuditCorrectBtn) {
    elements.cancelAuditCorrectBtn.addEventListener("click", closeAuditCorrectModal);
  }
  if (elements.confirmAuditCorrectBtn) {
    elements.confirmAuditCorrectBtn.addEventListener("click", confirmAuditCorrect);
  }
  if (elements.auditCorrectModalBackdrop) {
    elements.auditCorrectModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.auditCorrectModalBackdrop) closeAuditCorrectModal();
    });
  }

  if (elements.gradingSubmissionHistoryBtn) {
    elements.gradingSubmissionHistoryBtn.addEventListener("click", openSubmissionHistoryModal);
  }
  if (elements.closeSubmissionHistoryModalBtn) {
    elements.closeSubmissionHistoryModalBtn.addEventListener("click", closeSubmissionHistoryModal);
  }
  if (elements.closeSubmissionHistoryBottomBtn) {
    elements.closeSubmissionHistoryBottomBtn.addEventListener("click", closeSubmissionHistoryModal);
  }
  if (elements.submissionHistoryModalBackdrop) {
    elements.submissionHistoryModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.submissionHistoryModalBackdrop) closeSubmissionHistoryModal();
    });
  }

  if (elements.gradingAuthorizeResubmissionBtn) {
    elements.gradingAuthorizeResubmissionBtn.addEventListener("click", openAuthorizeResubmissionModal);
  }
  if (elements.closeAuthorizeResubmissionModalBtn) {
    elements.closeAuthorizeResubmissionModalBtn.addEventListener("click", closeAuthorizeResubmissionModal);
  }
  if (elements.cancelAuthorizeResubmissionBtn) {
    elements.cancelAuthorizeResubmissionBtn.addEventListener("click", closeAuthorizeResubmissionModal);
  }
  if (elements.confirmAuthorizeResubmissionBtn) {
    elements.confirmAuthorizeResubmissionBtn.addEventListener("click", confirmAuthorizeResubmission);
  }
  if (elements.authorizeResubmissionModalBackdrop) {
    elements.authorizeResubmissionModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.authorizeResubmissionModalBackdrop) closeAuthorizeResubmissionModal();
    });
  }

  // Semesters Page Form & Button Listeners
  if (elements.createSemesterInlineForm) {
    elements.createSemesterInlineForm.addEventListener("submit", handleCreateSemesterInline);
  }
  if (elements.btnOpenCreateSemester) {
    elements.btnOpenCreateSemester.addEventListener("click", () => {
      const section = document.getElementById("createSemesterSection");
      const nameInput = document.getElementById("newSemName");
      if (section) section.scrollIntoView({ behavior: "smooth" });
      if (nameInput) nameInput.focus();
    });
  }
  if (elements.btnCancelCreateSemester) {
    elements.btnCancelCreateSemester.addEventListener("click", () => {
      if (elements.createSemesterInlineForm) elements.createSemesterInlineForm.reset();
    });
  }

  // Edit Semester Modal Listeners
  const closeEditSemBtn = document.getElementById("closeEditSemesterModalBtn");
  if (closeEditSemBtn) closeEditSemBtn.addEventListener("click", closeEditSemesterModal);
  const cancelEditSemBtn = document.getElementById("cancelEditSemesterBtn");
  if (cancelEditSemBtn) cancelEditSemBtn.addEventListener("click", closeEditSemesterModal);
  const editSemForm = document.getElementById("editSemesterForm");
  if (editSemForm) editSemForm.addEventListener("submit", handleSaveEditSemester);
  const editSemBackdrop = document.getElementById("editSemesterModalBackdrop");
  if (editSemBackdrop) {
    editSemBackdrop.addEventListener("click", (e) => {
      if (e.target === editSemBackdrop) closeEditSemesterModal();
    });
  }

  // Add Subject Modal Listeners
  const closeAddSubBtn = document.getElementById("closeAddSubjectModalBtn");
  if (closeAddSubBtn) closeAddSubBtn.addEventListener("click", closeAddSubjectModal);
  const cancelAddSubBtn = document.getElementById("cancelAddSubjectBtn");
  if (cancelAddSubBtn) cancelAddSubBtn.addEventListener("click", closeAddSubjectModal);
  const addSubForm = document.getElementById("addSubjectForm");
  if (addSubForm) addSubForm.addEventListener("submit", handleSubmitAddSubject);
  const addSubBackdrop = document.getElementById("addSubjectModalBackdrop");
  if (addSubBackdrop) {
    addSubBackdrop.addEventListener("click", (e) => {
      if (e.target === addSubBackdrop) closeAddSubjectModal();
    });
  }

  // Keyboard navigation & modal shortcuts
  document.addEventListener("keydown", (e) => {
    // 1. Check workflow sub-modals first to prevent event bleed into SpeedGrader
    if (elements.auditCorrectModalBackdrop && elements.auditCorrectModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeAuditCorrectModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.auditCorrectModalBackdrop);
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (elements.submissionHistoryModalBackdrop && elements.submissionHistoryModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSubmissionHistoryModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.submissionHistoryModalBackdrop);
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (elements.authorizeResubmissionModalBackdrop && elements.authorizeResubmissionModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeAuthorizeResubmissionModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.authorizeResubmissionModalBackdrop);
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // 2. Submission preview modal
    if (elements.submissionPreviewModalBackdrop && elements.submissionPreviewModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSubmissionPreviewModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.submissionPreviewModalBackdrop);
      }
      return;
    }

    // 3. Confirmation modals
    if (elements.singleReleaseConfirmBackdrop && elements.singleReleaseConfirmBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSingleReleaseModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.singleReleaseConfirmBackdrop);
      }
      return;
    }
    if (elements.bulkReleaseConfirmBackdrop && elements.bulkReleaseConfirmBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        e.preventDefault();
        closeBulkReleaseModal();
        return;
      }
      if (e.key === "Tab") {
        trapFocusInModal(e, elements.bulkReleaseConfirmBackdrop);
      }
      return;
    }

    // 4. Grading workspace modal
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
      headers: getAuthHeaders(),
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

    const rawData = await response.json();
    const seenIds = new Set();
    const data = (Array.isArray(rawData) ? rawData : []).filter((item) => {
      if (!item || item.id === undefined || item.id === null) return true;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
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

  if (state.isSubmittingAssignment) {
    return;
  }

  if (!validateForm()) {
    return;
  }

  state.isSubmittingAssignment = true;
  setFormLoading(true);

  // Determine Subject
  let subjectValue = elements.formSubject.value;
  if (subjectValue === "Other") {
    subjectValue = elements.formCustomSubject.value.trim() || "General";
  }

  const selectedSubOpt = elements.formSubject.selectedOptions && elements.formSubject.selectedOptions[0];
  const subjectIdVal = selectedSubOpt && selectedSubOpt.dataset && selectedSubOpt.dataset.subjectId;

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
  if (subjectIdVal) {
    formData.append("subject_id", subjectIdVal);
  }
  const descVal = elements.formDescription.value.trim();
  if (descVal) {
    formData.append("description", descVal);
  }
  formData.append("due_date", isoDueDate);
  formData.append("status", elements.formStatus.value);

  // Unit / Assessment
  const unitVal = elements.formUnit ? elements.formUnit.value : "Unit 1";
  formData.append("assignment_type", unitVal);

  // Maximum Marks
  const marksVal = elements.formMaxMarks ? elements.formMaxMarks.value : "100";
  formData.append("max_marks", marksVal);

  // Policies (Safe intentional defaults: reject late, approval_only resubmissions)
  const latePolicyRadio = elements.assignmentForm.querySelector('input[name="latePolicy"]:checked');
  const latePolicyVal = latePolicyRadio ? latePolicyRadio.value : "reject";
  formData.append("late_policy", latePolicyVal);

  const resubPolicyRadio = elements.assignmentForm.querySelector('input[name="resubmissionPolicy"]:checked');
  const resubPolicyVal = resubPolicyRadio ? resubPolicyRadio.value : "approval_only";
  formData.append("resubmission_policy", resubPolicyVal);

  // Link to Class
  const classVal = elements.formClass ? elements.formClass.value : "";
  let selectedClass = null;
  if (classVal) {
    formData.append("class_id", classVal);
    selectedClass = (state.classes || []).find((c) => c.id === parseInt(classVal, 10));
  } else if (isEditing) {
    formData.append("class_id", "null");
  }

  // Link to Semester strictly from real relationship
  if (selectedClass) {
    if (selectedClass.semester_id) {
      formData.append("semester_id", String(selectedClass.semester_id));
    } else {
      formData.append("semester_id", "null");
    }
  } else if (elements.formSemesterId && elements.formSemesterId.value) {
    formData.append("semester_id", elements.formSemesterId.value);
  } else if (isEditing) {
    formData.append("semester_id", "null");
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

    const isDraft = savedAssignment.status === "draft";
    const targetClassName = savedAssignment.class_name || (elements.formClass?.selectedOptions?.[0]?.textContent) || "Class";
    const formattedDeadline = formatDisplayDateTime(savedAssignment.due_date);

    if (isDraft) {
      showToast(`Saved draft "${savedAssignment.title}". Students cannot see this assignment until published.`, "info");
    } else {
      showToast(
        isEditing
          ? `Assignment "${savedAssignment.title}" updated for ${targetClassName} (${savedAssignment.subject}) — Deadline: ${formattedDeadline}`
          : `Assignment "${savedAssignment.title}" published for ${targetClassName} (${savedAssignment.subject}) — Deadline: ${formattedDeadline}`,
        "success"
      );
    }

    // Refresh assignments list and classes from database
    await fetchAssignments();
    await fetchClasses();

    if (!isDraft) {
      if (typeof switchView === "function" && state.currentView !== "assignments") {
        switchView("assignments");
      }
      if (elements.classFilter && savedAssignment.class_id) {
        elements.classFilter.value = String(savedAssignment.class_id);
        applyFiltersAndRender();
      }
    }

    if (typeof renderSubjectDetailView === "function" && (state.activeView === "classes" || state.currentView === "classes") && state.activeSubjectId) {
      await renderSubjectDetailView();
    }
    if (state.activeSemesterId && typeof fetchSemesters === "function") {
      await fetchSemesters();
    }
  } catch (error) {
    console.error("Save error:", error);
    showToast(`Error: ${error.message}`, "error");
  } finally {
    setFormLoading(false);
    state.isSubmittingAssignment = false;
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

/**
 * Loads subjects associated with a specific class ID.
 * - When classId is provided, fetches ONLY subjects belonging to that class from backend API.
 * - If class has no subjects, shows clear empty state and button to add a subject.
 * - If classId is null (General / Unassigned standalone mode), populates standalone default options.
 */
async function loadClassSubjects(classId, preselectedSubjectName = null, preselectedSubjectId = null) {
  if (!elements.formSubject) return;

  if (!classId) {
    // When no class is selected: subject dropdown must be disabled with placeholder
    elements.formSubject.innerHTML = '<option value="" disabled selected>Select a class first</option>';
    elements.formSubject.disabled = true;
    elements.formSubject.value = "";
    if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "none";
    if (elements.subjectEmptyState) elements.subjectEmptyState.style.display = "none";
    if (elements.customSubjectGroup) elements.customSubjectGroup.style.display = "none";
    return;
  }

  // Clear existing options
  elements.formSubject.innerHTML = '<option value="" disabled selected>Select subject</option>';
  if (elements.subjectEmptyState) elements.subjectEmptyState.style.display = "none";
  if (elements.customSubjectGroup) elements.customSubjectGroup.style.display = "none";

  // Enable formSubject unless locked by context
  const isSubjectLocked = Boolean(state.drawerContext && state.drawerContext.isSubjectLocked);
  if (!isSubjectLocked) {
    elements.formSubject.disabled = false;
  }

  // Fetch subjects for this specific class ID
  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}/subjects`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const subjects = await res.json();
      if (subjects && subjects.length > 0) {
        subjects.forEach((sub) => {
          const opt = document.createElement("option");
          opt.value = sub.name;
          opt.textContent = sub.name;
          opt.dataset.subjectId = String(sub.id);
          elements.formSubject.appendChild(opt);
        });

        // Determine which subject to select
        if (preselectedSubjectId) {
          const optById = Array.from(elements.formSubject.options).find(
            (o) => o.dataset.subjectId === String(preselectedSubjectId)
          );
          if (optById) {
            elements.formSubject.value = optById.value;
            return;
          }
        }

        if (preselectedSubjectName) {
          const optByName = Array.from(elements.formSubject.options).find(
            (o) => o.value.trim().toLowerCase() === preselectedSubjectName.trim().toLowerCase()
          );
          if (optByName) {
            elements.formSubject.value = optByName.value;
            return;
          }
        }

        if (subjects.length === 1) {
          elements.formSubject.value = subjects[0].name;
        } else {
          elements.formSubject.value = "";
        }
      } else {
        // No subjects found for this class
        if (elements.subjectEmptyState) {
          elements.subjectEmptyState.style.display = "flex";
        }
        elements.formSubject.value = "";
      }
    } else {
      if (elements.subjectEmptyState) {
        elements.subjectEmptyState.style.display = "flex";
      }
      elements.formSubject.value = "";
    }
  } catch (err) {
    console.error("Failed to fetch subjects for class:", err);
    if (elements.subjectEmptyState) {
      elements.subjectEmptyState.style.display = "flex";
    }
  }
}

/**
 * Sets the subject field value in the assignment drawer.
 * If the subject matches a predefined option, selects it.
 * If not, dynamically adds an option for the subject and selects it.
 */
function setFormSubjectValue(subjectName) {
  if (!elements.formSubject) return;

  // Clean up any previously added dynamic subject options
  const dynamicOpts = elements.formSubject.querySelectorAll(".dynamic-subject-opt");
  dynamicOpts.forEach((opt) => opt.remove());

  // Derive subject from selected class or drawer context if not explicitly provided
  if (!subjectName && elements.formClass && elements.formClass.value) {
    const selCid = parseInt(elements.formClass.value, 10);
    const cls = (state.classes || []).find((c) => c.id === selCid) || state.activeSubject;
    if (cls && cls.name) {
      subjectName = cls.name;
    } else {
      const selOpt = elements.formClass.selectedOptions && elements.formClass.selectedOptions[0];
      if (selOpt && selOpt.value && selOpt.textContent && selOpt.textContent !== "General / Unassigned") {
        subjectName = selOpt.textContent;
      }
    }
  }
  if (!subjectName && state.drawerContext && state.drawerContext.subjectName) {
    subjectName = state.drawerContext.subjectName;
  }

  if (!subjectName) {
    elements.formSubject.value = "";
    if (elements.customSubjectGroup) elements.customSubjectGroup.style.display = "none";
    if (elements.formCustomSubject) elements.formCustomSubject.value = "";
    return;
  }

  // Check if an option already exists with this exact value or text (case-insensitive)
  const matchedOption = Array.from(elements.formSubject.options).find(
    (opt) =>
      opt.value.trim().toLowerCase() === subjectName.trim().toLowerCase() ||
      opt.textContent.trim().toLowerCase() === subjectName.trim().toLowerCase()
  );

  if (matchedOption) {
    elements.formSubject.value = matchedOption.value;
    if (elements.customSubjectGroup) elements.customSubjectGroup.style.display = "none";
    if (elements.formCustomSubject) elements.formCustomSubject.value = "";
  } else {
    // Add the semester subject as a select option so it displays cleanly in the UI
    const newOpt = document.createElement("option");
    newOpt.value = subjectName;
    newOpt.textContent = subjectName;
    newOpt.className = "dynamic-subject-opt";

    const otherOpt = Array.from(elements.formSubject.options).find((o) => o.value === "Other");
    if (otherOpt) {
      elements.formSubject.insertBefore(newOpt, otherOpt);
    } else {
      elements.formSubject.appendChild(newOpt);
    }

    elements.formSubject.value = subjectName;
    if (elements.customSubjectGroup) elements.customSubjectGroup.style.display = "none";
    if (elements.formCustomSubject) elements.formCustomSubject.value = "";
  }
}

function getSemesterDisplayName(semesterId, classObj = null) {
  if (!semesterId) return "";
  const sid = parseInt(semesterId, 10);
  if (isNaN(sid)) return "";
  const sem = (state.semesters || []).find((s) => s.id === sid);
  if (sem) {
    const rawName = sem.name || (sem.semester_number ? `Semester ${sem.semester_number}` : "");
    const semName = rawName ? (rawName.charAt(0).toUpperCase() + rawName.slice(1)) : "Semester";
    const year = sem.academic_year ? ` · ${sem.academic_year}` : "";
    const term = sem.type ? ` (${sem.type.charAt(0).toUpperCase() + sem.type.slice(1)})` : "";
    return `${semName}${year}${term}`;
  }
  if (classObj && classObj.semester_name) {
    return classObj.semester_name;
  }
  const clsMatch = (state.classes || []).find((c) => c.semester_id === sid && c.semester_name);
  if (clsMatch) {
    return clsMatch.semester_name;
  }
  // Never fabricate or infer a fake semester label from an internal database ID
  return "";
}

function removeSelectedFile() {
  if (elements.formPdf) elements.formPdf.value = "";
  if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
  if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
  resetDropzoneText();
}

function openDrawer(assignmentToEdit = null, context = null) {
  clearFormErrors();

  // Detect and set local timezone label
  if (elements.dueDateTzLabel) {
    try {
      const shortTz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || "";
      elements.dueDateTzLabel.textContent = shortTz ? `(${shortTz})` : "";
    } catch (e) {
      elements.dueDateTzLabel.textContent = "";
    }
  }

  // Ensure semesters are loaded for correct semester display
  if (!state.semesters || state.semesters.length === 0) {
    fetchSemesters().then(() => {
      if (elements.assignmentDrawer && elements.assignmentDrawer.classList.contains("active")) {
        const curSemId = elements.formSemesterId ? elements.formSemesterId.value : null;
        if (curSemId) {
          const freshName = getSemesterDisplayName(curSemId);
          if (freshName && elements.formSemesterDisplay) {
            elements.formSemesterDisplay.value = freshName;
          }
          if (freshName && elements.drawerSubtitle && elements.drawerSubtitle.style.display !== "none") {
            const currentSub = elements.drawerSubtitle.textContent || "";
            const parts = currentSub.split(" — ").filter((p) => !p.toLowerCase().includes("semester"));
            parts.push(freshName);
            elements.drawerSubtitle.textContent = parts.join(" — ");
          }
        }
      }
    }).catch(() => {});
  }

  if (assignmentToEdit) {
    state.drawerContext = null;
    state.editingId = assignmentToEdit.id;
    elements.drawerTitle.textContent = "Edit Assignment";
    if (elements.drawerSubtitle) elements.drawerSubtitle.style.display = "none";
    elements.submitBtnText.textContent = assignmentToEdit.status === "draft" ? "Publish Assignment" : "Save Changes";
    if (elements.drawerDraftBtn) {
      elements.drawerDraftBtn.style.display = assignmentToEdit.status === "draft" ? "inline-flex" : "none";
    }

    elements.assignmentId.value = assignmentToEdit.id;
    if (elements.formSemesterId) {
      elements.formSemesterId.value = assignmentToEdit.semester_id ? String(assignmentToEdit.semester_id) : "";
    }
    const editSemDisplay = getSemesterDisplayName(assignmentToEdit.semester_id, (state.classes || []).find((c) => c.id === assignmentToEdit.class_id));
    if (elements.formSemesterDisplay) {
      elements.formSemesterDisplay.value = editSemDisplay || (assignmentToEdit.semester_id ? "" : "None (Independent Class)");
    }
    if (elements.semesterLockIcon) {
      elements.semesterLockIcon.style.display = assignmentToEdit.semester_id ? "flex" : "none";
    }

    elements.formTitle.value = assignmentToEdit.title || "";
    if (elements.formUnit) {
      elements.formUnit.value = assignmentToEdit.assignment_type || "Unit 1";
    }
    if (elements.formMaxMarks) {
      elements.formMaxMarks.value = assignmentToEdit.max_marks != null ? String(assignmentToEdit.max_marks) : "";
    }

    // Set Subject
    setFormSubjectValue(assignmentToEdit.subject);

    elements.formDescription.value = assignmentToEdit.description || "";
    elements.formDueDate.value = formatInputDate(assignmentToEdit.due_date);
    elements.formStatus.value = assignmentToEdit.status || "active";
    if (elements.formClass) {
      elements.formClass.value = assignmentToEdit.class_id ? String(assignmentToEdit.class_id) : "";
    }
    loadClassSubjects(assignmentToEdit.class_id, assignmentToEdit.subject, assignmentToEdit.subject_id);

    // Set policy radios: preserve existing assignment settings
    const lateVal = assignmentToEdit.allow_late !== false ? "accept" : "reject";
    const lateRadio = elements.assignmentForm.querySelector(`input[name="latePolicy"][value="${lateVal}"]`);
    if (lateRadio) lateRadio.checked = true;

    const resubVal = assignmentToEdit.resubmission_policy === "until_due" ? "until_due" : "approval_only";
    const resubRadio = elements.assignmentForm.querySelector(`input[name="resubmissionPolicy"][value="${resubVal}"]`);
    if (resubRadio) resubRadio.checked = true;

    // Check existing submissions: lock class & subject if submissions exist
    const subCount = assignmentToEdit.submission_count || 0;
    if (subCount > 0) {
      if (elements.formClass) elements.formClass.disabled = true;
      if (elements.classLockIcon) elements.classLockIcon.style.display = "flex";
      if (elements.formSubject) elements.formSubject.disabled = true;
      if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "flex";
    } else {
      if (elements.formClass) elements.formClass.disabled = false;
      if (elements.classLockIcon) elements.classLockIcon.style.display = "none";
      if (elements.formSubject) elements.formSubject.disabled = false;
      if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "none";
    }

    // Reset file input for edit mode
    elements.formPdf.value = "";
    if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
    if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
    elements.dropzoneText.textContent = "Choose new PDF to replace (optional)";

    // Display existing attachment details if attached
    if (assignmentToEdit.has_attachment && assignmentToEdit.file_name) {
      elements.currentAttachmentBox.style.display = "flex";
      elements.currentAttachmentName.textContent = `${assignmentToEdit.file_name} (${formatBytes(assignmentToEdit.file_size || 0)})`;
      if (elements.pdfRequiredStar) elements.pdfRequiredStar.style.display = "none";
    } else {
      elements.currentAttachmentBox.style.display = "none";
      if (elements.pdfRequiredStar) elements.pdfRequiredStar.style.display = "none";
    }
  } else {
    state.editingId = null;
    elements.assignmentForm.reset();
    elements.assignmentId.value = "";
    elements.formPdf.value = "";
    if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
    if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
    elements.dropzoneText.textContent = "Choose question PDF or drag & drop";
    elements.currentAttachmentBox.style.display = "none";
    if (elements.pdfRequiredStar) elements.pdfRequiredStar.style.display = "none";
    elements.customSubjectGroup.style.display = "none";

    // Default due date to 7 days in the future
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    defaultDate.setHours(23, 59, 0, 0);
    elements.formDueDate.value = formatInputDate(defaultDate);
    elements.formStatus.value = "active";
    if (elements.formMaxMarks) elements.formMaxMarks.value = "";
    if (elements.formUnit) elements.formUnit.value = "Unit 1";
    if (elements.drawerDraftBtn) elements.drawerDraftBtn.style.display = "inline-flex";
    if (elements.drawerSubmitBtn) elements.drawerSubmitBtn.style.display = "inline-flex";

    // Safe intentional defaults: Reject late submissions, Approval-only resubmission
    const defLate = elements.assignmentForm.querySelector('input[name="latePolicy"][value="reject"]');
    if (defLate) defLate.checked = true;
    const defResub = elements.assignmentForm.querySelector('input[name="resubmissionPolicy"][value="approval_only"]');
    if (defResub) defResub.checked = true;

    // If context was not explicitly passed, infer it if user is currently inside a semester subject view
    if (!context && state.activeSubjectId && (state.activeView === "classes" || state.currentView === "classes")) {
      const cls = (state.classes || []).find((c) => c.id === state.activeSubjectId) || state.activeSubject;
      if (cls) {
        context = {
          type: cls.semester_id ? "semester_subject" : "class",
          subjectId: cls.id,
          subjectName: cls.name,
          classId: cls.id,
          className: cls.name,
          semesterId: cls.semester_id || null,
        };
      }
    }

    if (context && (context.type === "semester_subject" || context.type === "class" || context.subjectId || context.classId)) {
      const sid = context.subjectId || context.classId;
      let sname = context.subjectName || context.className;
      let targetCls = null;
      if (sid) {
        targetCls = (state.classes || []).find((c) => c.id === parseInt(sid, 10)) || state.activeSubject;
        if (!sname && targetCls) sname = targetCls.name;
      }
      // Strictly derive semester from target class if available, never fallback to unrelated activeSemesterId
      const semId = (context.semesterId !== undefined && String(context.semesterId) !== "null" && context.semesterId !== null)
        ? context.semesterId
        : (targetCls ? (targetCls.semester_id || null) : null);

      context.subjectId = sid;
      context.subjectName = sname;
      context.semesterId = semId;
      context.type = semId ? "semester_subject" : "class";
      state.drawerContext = context;

      const isSubjectLocked = context.isSubjectLocked || (context.type === "semester_subject" && Boolean(context.subjectName));

      elements.drawerTitle.textContent = context.subjectName
        ? `Create Assignment — ${context.subjectName}`
        : "Create Assignment";
      elements.submitBtnText.textContent = "Publish Assignment";

      const semDisplay = getSemesterDisplayName(semId, targetCls);
      if (elements.drawerSubtitle) {
        const subParts = [];
        if (context.className) subParts.push(context.className);
        else if (context.subjectName && !isSubjectLocked) subParts.push(context.subjectName);
        if (semDisplay) subParts.push(semDisplay);

        if (subParts.length > 0) {
          elements.drawerSubtitle.textContent = subParts.join(" — ");
          elements.drawerSubtitle.style.display = "block";
        } else {
          elements.drawerSubtitle.style.display = "none";
        }
      }

      // Ensure formClass options include all classes if available
      if (state.classes && state.classes.length > 0 && elements.formClass && elements.formClass.options.length <= 1) {
        populateFormClassOptions(state.classes);
      }

      // Ensure option exists in elements.formClass for the subject/class
      if (elements.formClass && context.subjectId) {
        let opt = Array.from(elements.formClass.options).find(
          (o) => o.value === String(context.subjectId)
        );
        if (!opt) {
          opt = document.createElement("option");
          opt.value = String(context.subjectId);
          opt.textContent = context.subjectName || `Class #${context.subjectId}`;
          elements.formClass.appendChild(opt);
        }
        elements.formClass.value = String(context.subjectId);
        elements.formClass.disabled = true;
        if (elements.classLockIcon) elements.classLockIcon.style.display = "flex";
      }

      if (elements.formSemesterDisplay) {
        elements.formSemesterDisplay.value = semDisplay || (semId ? "" : "None (Independent Class)");
      }
      if (elements.semesterLockIcon) {
        elements.semesterLockIcon.style.display = semId ? "flex" : "none";
      }

      if (isSubjectLocked) {
        if (elements.formSubject) elements.formSubject.disabled = true;
        if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "flex";
        setFormSubjectValue(context.subjectName);
        loadClassSubjects(context.subjectId, context.subjectName);
      } else {
        if (elements.formSubject) elements.formSubject.disabled = false;
        if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "none";
        loadClassSubjects(context.subjectId);
      }

      if (elements.formSemesterId) {
        elements.formSemesterId.value = context.semesterId ? String(context.semesterId) : "";
      }
    } else {
      state.drawerContext = null;
      elements.drawerTitle.textContent = "Create Assignment";
      if (elements.drawerSubtitle) elements.drawerSubtitle.style.display = "none";
      elements.submitBtnText.textContent = "Publish Assignment";

      if (elements.formClass) {
        elements.formClass.disabled = false;
        elements.formClass.value = "";
      }
      if (elements.classLockIcon) elements.classLockIcon.style.display = "none";
      if (elements.formSubject) {
        elements.formSubject.disabled = true;
      }
      if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "none";
      if (elements.formSemesterDisplay) elements.formSemesterDisplay.value = "";
      if (elements.semesterLockIcon) elements.semesterLockIcon.style.display = "none";
      if (elements.formSemesterId) elements.formSemesterId.value = "";

      populateFormClassOptions(state.classes || []);
      setFormSubjectValue("");
      loadClassSubjects(null);
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
  state.drawerContext = null;
  if (elements.formSemesterId) elements.formSemesterId.value = "";
  if (elements.formSemesterDisplay) elements.formSemesterDisplay.value = "";
  if (elements.formClass) elements.formClass.disabled = false;
  if (elements.formSubject) elements.formSubject.disabled = false;
  if (elements.classLockIcon) elements.classLockIcon.style.display = "none";
  if (elements.subjectLockIcon) elements.subjectLockIcon.style.display = "none";
  if (elements.semesterLockIcon) elements.semesterLockIcon.style.display = "none";
  if (elements.subjectEmptyState) elements.subjectEmptyState.style.display = "none";
  if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
  if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
  if (elements.formSubject) {
    const dynamicOpts = elements.formSubject.querySelectorAll(".dynamic-subject-opt");
    dynamicOpts.forEach((opt) => opt.remove());
  }
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

  const selectedClass = elements.formClass ? elements.formClass.value : "";
  if (!selectedClass) {
    if (elements.classError) {
      elements.classError.textContent = "Please select a class.";
    }
    isValid = false;
  }

  if (elements.formClass && elements.formClass.value && elements.subjectEmptyState && elements.subjectEmptyState.style.display !== "none") {
    elements.subjectError.textContent = "No subjects added to this class yet. Please add a subject first.";
    isValid = false;
  } else if (!elements.formSubject.value) {
    elements.subjectError.textContent = "Please select a subject.";
    isValid = false;
  } else if (elements.formSubject.value === "Other" && !elements.formCustomSubject.value.trim()) {
    elements.subjectError.textContent = "Please enter the custom subject name.";
    isValid = false;
  }

  // Prevent accidental creation under General / Unassigned when semester subject context exists
  const hasSemesterContext = Boolean(
    (state.drawerContext && state.drawerContext.type === "semester_subject") ||
    (elements.formSemesterId && elements.formSemesterId.value)
  );
  if (hasSemesterContext) {
    if (!selectedClass) {
      if (elements.classError) {
        elements.classError.textContent = "Please select a class. Semester assignments cannot be published to General / Unassigned.";
      }
      isValid = false;
    }
  }

  // Maximum Marks validation
  const marksVal = parseFloat(elements.formMaxMarks ? elements.formMaxMarks.value : "");
  if (isNaN(marksVal) || marksVal <= 0 || marksVal > 1000) {
    if (elements.maxMarksError) {
      elements.maxMarksError.textContent = "Please enter maximum marks (positive number up to 1000).";
    }
    isValid = false;
  }

  // Question PDF & Instructions validation (at least one is required when publishing)
  const isDraft = elements.formStatus.value === "draft";
  const hasFile = elements.formPdf.files && elements.formPdf.files.length > 0;
  const isEditing = Boolean(state.editingId);
  const hasExistingAttachment = Boolean(isEditing && elements.currentAttachmentBox && elements.currentAttachmentBox.style.display !== "none");
  const cleanInstructions = elements.formDescription ? elements.formDescription.value.trim() : "";

  if (!isDraft && !hasFile && !hasExistingAttachment && !cleanInstructions) {
    if (elements.descriptionError) {
      elements.descriptionError.textContent = "Please enter instructions or attach a question PDF (at least one is required).";
    }
    if (elements.pdfError) {
      elements.pdfError.textContent = "At least one of Instructions or Question PDF is required.";
    }
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

  // Due Date validation
  if (!elements.formDueDate.value) {
    elements.dueDateError.textContent = "Please choose a valid deadline date and time.";
    isValid = false;
  } else if (elements.formStatus.value === "active") {
    const chosenDate = new Date(elements.formDueDate.value);
    if (chosenDate <= new Date()) {
      elements.dueDateError.textContent = "Due date must be in the future when publishing an assignment.";
      isValid = false;
    }
  }

  return isValid;
}

function clearFormErrors() {
  if (elements.titleError) elements.titleError.textContent = "";
  if (elements.subjectError) elements.subjectError.textContent = "";
  if (elements.dueDateError) elements.dueDateError.textContent = "";
  if (elements.pdfError) elements.pdfError.textContent = "";
  if (elements.classError) elements.classError.textContent = "";
  if (elements.maxMarksError) elements.maxMarksError.textContent = "";
  if (elements.descriptionError) elements.descriptionError.textContent = "";
}

function handleFileSelection(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    if (elements.pdfError) elements.pdfError.textContent = "Please select a valid PDF document (.pdf).";
    if (elements.dropzoneText) elements.dropzoneText.textContent = "Invalid file type (PDF required)";
    if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
    if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
    return;
  }
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    if (elements.pdfError) elements.pdfError.textContent = "File size exceeds the 10MB maximum limit.";
    if (elements.dropzoneText) elements.dropzoneText.textContent = "File too large (max 10MB)";
    if (elements.selectedFileCard) elements.selectedFileCard.style.display = "none";
    if (elements.fileDropzone) elements.fileDropzone.style.display = "flex";
    return;
  }
  if (elements.pdfError) elements.pdfError.textContent = "";
  if (elements.descriptionError) elements.descriptionError.textContent = "";
  if (elements.selectedFileCard && elements.selectedFileName && elements.selectedFileSize) {
    elements.selectedFileName.textContent = file.name;
    elements.selectedFileSize.textContent = formatBytes(file.size);
    elements.selectedFileCard.style.display = "flex";
    if (elements.fileDropzone) elements.fileDropzone.style.display = "none";
  } else if (elements.dropzoneText) {
    elements.dropzoneText.textContent = `${file.name} (${formatBytes(file.size)})`;
  }
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
  if (elements.drawerSubmitBtn) elements.drawerSubmitBtn.disabled = isLoading;
  if (elements.drawerDraftBtn) elements.drawerDraftBtn.disabled = isLoading;
  if (elements.drawerCancelBtn) elements.drawerCancelBtn.disabled = isLoading;
  if (elements.submitSpinner) elements.submitSpinner.style.display = isLoading ? "inline-block" : "none";
  if (elements.submitBtnText) elements.submitBtnText.style.display = isLoading ? "none" : "inline";
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
 * Authentication token storage helpers
 * Safely retains session token across browser hard-refreshes (Ctrl + Shift + R)
 */
function getAuthToken() {
  try {
    return localStorage.getItem("assignflow_token");
  } catch (e) {
    return null;
  }
}

function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem("assignflow_token", token);
    } else {
      localStorage.removeItem("assignflow_token");
    }
  } catch (e) {
    console.warn("Storage access warning:", e);
  }
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { Accept: "application/json", ...extraHeaders };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Checks existing session against GET /api/auth/me
 */
async function checkCurrentUser() {
  try {
    const res = await fetch(API_ENDPOINTS.authMe, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const user = await res.json();
      state.currentUser = user;
      updateUserUI(user);
      await Promise.all([fetchClasses(), fetchSemesters()]);
      const rawRoute = (window.location.hash || "").replace(/^#\/?/, "");
      const subjectMatch = rawRoute.match(/^(?:classes|subjects)\/(\d+)/i);
      if (subjectMatch) {
        viewSubjectDetail(parseInt(subjectMatch[1], 10));
      } else {
        const initialRoute = rawRoute.toLowerCase() || "dashboard";
        navigateToView(initialRoute, false);
      }
    } else {
      setAuthToken(null);
      state.currentUser = null;
      updateUserUI(null);
      openAuthModal("signin");
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    setAuthToken(null);
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

const AVATAR_PALETTE = ["#2563eb", "#0284c7", "#475569", "#0d9488", "#f59e0b", "#e11d48", "#3b82f6", "#10b981"];

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

const SUPPORTED_VIEWS = [
  "dashboard",
  "semesters",
  "assignments",
  "classes",
  "subjects",
  "submissions",
  "students",
  "reports",
  "calendar",
  "notifications",
  "analytics",
  "settings",
];

/**
 * Switch primary view and keep URL hash + sidebar synchronized
 */
function navigateToView(viewName, updateHash = true) {
  let rawView = (viewName || "").toLowerCase().trim();
  let targetView = rawView;

  // Handle aliases
  if (targetView === "subjects") targetView = "classes";
  if (targetView === "students") targetView = "submissions";
  if (targetView === "notifications") targetView = "calendar";

  if (!SUPPORTED_VIEWS.includes(targetView) && !SUPPORTED_VIEWS.includes(rawView)) {
    targetView = "dashboard";
  }

  state.activeView = targetView;
  state.currentView = targetView;

  if (updateHash) {
    if (window.location.hash !== `#${rawView}`) {
      window.location.hash = `#${rawView}`;
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

  // 3. Synchronize active highlight across top navbar and drawer
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  document.querySelectorAll(`.nav-link[data-nav="${rawView}"], .nav-link[data-nav="${targetView}"]`).forEach((link) => {
    link.classList.add("active");
  });

  // 4. Trigger view-specific data loading
  if (targetView === "dashboard") {
    fetchDashboard();
  } else if (targetView === "semesters") {
    loadSemestersPageView();
  } else if (targetView === "assignments") {
    fetchAssignments();
  } else if (targetView === "classes") {
    loadClassesPageView();
  } else if (targetView === "submissions") {
    loadSubmissionsPageView();
  } else if (targetView === "reports") {
    loadReportsPageView();
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

  if (state.activeSubjectId) {
    const actionsGroup = document.getElementById("classesPageActions");
    if (actionsGroup) actionsGroup.style.display = "none";
    const headerRow = document.querySelector("#classesView .page-header-row");
    if (headerRow) headerRow.style.display = "none";
    if (!state.classes || state.classes.length === 0) {
      await fetchClasses();
    }
    await renderSubjectDetailView();
    return;
  } else {
    const actionsGroup = document.getElementById("classesPageActions");
    if (actionsGroup) actionsGroup.style.display = "flex";
    const headerRow = document.querySelector("#classesView .page-header-row");
    if (headerRow) headerRow.style.display = "flex";
  }

  const isTeacher = state.currentUser?.role === "teacher";
  if (elements.classesPageTitle) {
    elements.classesPageTitle.textContent = isTeacher ? "Classes & Subjects" : "My Classes & Subjects";
  }
  if (elements.classesPageSubtitle) {
    elements.classesPageSubtitle.textContent = isTeacher
      ? "Manage your course subjects, share join codes with students, and track subject-level performance."
      : "View your enrolled courses and join new classrooms using join codes.";
  }
  if (elements.classesPageActionText) {
    elements.classesPageActionText.textContent = isTeacher ? "Create Class" : "Join Class";
  }

  await fetchClasses();

  const classes = state.classes || [];
  const totalClasses = classes.length;
  const totalSubjects = totalClasses;
  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  const totalAssignments = classes.reduce((sum, c) => sum + (c.assignment_count || 0), 0);

  function getSubjectAbbr(cls) {
    if (cls.code && cls.code.trim().length <= 4) return cls.code.trim().toUpperCase();
    const name = (cls.name || "").trim();
    const words = name.split(/\s+/);
    if (words.length > 1) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "CL";
  }

  // 1. KPI Cards Row
  const kpiHtml = `
    <div class="classes-kpi-row">
      <div class="classes-kpi-card" onclick="document.getElementById('classesSearchInput')?.focus()">
        <div class="classes-kpi-left">
          <div class="classes-kpi-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="classes-kpi-info">
            <span class="classes-kpi-num">${totalClasses}</span>
            <span class="classes-kpi-label">${isTeacher ? "Total Classes" : "Enrolled Classes"}</span>
          </div>
        </div>
        <div class="classes-kpi-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div class="classes-kpi-card" onclick="document.getElementById('classesSearchInput')?.focus()">
        <div class="classes-kpi-left">
          <div class="classes-kpi-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
              <path d="M6 6h10"/>
              <path d="M6 10h10"/>
            </svg>
          </div>
          <div class="classes-kpi-info">
            <span class="classes-kpi-num">${totalSubjects}</span>
            <span class="classes-kpi-label">Total Subjects</span>
          </div>
        </div>
        <div class="classes-kpi-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div class="classes-kpi-card">
        <div class="classes-kpi-left">
          <div class="classes-kpi-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div class="classes-kpi-info">
            <span class="classes-kpi-num">${totalStudents}</span>
            <span class="classes-kpi-label">Total Students</span>
          </div>
        </div>
        <div class="classes-kpi-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      <div class="classes-kpi-card" onclick="navigateToView('assignments')">
        <div class="classes-kpi-left">
          <div class="classes-kpi-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="classes-kpi-info">
            <span class="classes-kpi-num">${totalAssignments}</span>
            <span class="classes-kpi-label">Total Assignments</span>
          </div>
        </div>
        <div class="classes-kpi-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </div>
  `;

  // 2. Toolbar Row (Search, Semester Filter, View Mode Toggle)
  let semestersOptions = '<option value="">All Semesters</option>';
  if (state.semesters && state.semesters.length > 0) {
    semestersOptions += state.semesters.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  }

  const toolbarHtml = `
    <div class="classes-toolbar-row">
      <div class="classes-toolbar-left">
        <div class="classes-search-wrap">
          <svg class="classes-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="classesSearchInput" class="classes-search-input" placeholder="Search classes or subjects..." autocomplete="off">
        </div>
        <div class="classes-select-wrap">
          <select id="classesSemesterFilter" class="classes-semester-select">
            ${semestersOptions}
          </select>
          <svg class="classes-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div class="classes-toolbar-right">
        <div class="classes-view-toggle">
          <button type="button" class="classes-toggle-btn active" id="classesViewGridBtn" title="Grid View">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
          </button>
          <button type="button" class="classes-toggle-btn" id="classesViewListBtn" title="List View">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
        <button type="button" class="btn btn-primary classes-toolbar-create-btn" onclick="openClassesModal()" title="${isTeacher ? 'Create Class' : 'Join Class'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>${isTeacher ? "Create Class" : "Join Class"}</span>
        </button>
      </div>
    </div>
  `;

  // Helper function to generate cards HTML
  function renderCards(classesToRender) {
    if (!classesToRender || classesToRender.length === 0) {
      return `
        <div class="classes-empty-filtered" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--text-secondary);">
          <p>No matching classes or subjects found.</p>
        </div>
      `;
    }

    return classesToRender.map((cls, idx) => {
      const isBlue = idx % 2 === 1;
      const accentClass = isBlue ? "accent-blue" : "accent-emerald";
      const iconThemeClass = isBlue ? "icon-blue" : "icon-emerald";
      const statIconClass = isBlue ? "stat-icon-blue" : "stat-icon-emerald";
      const abbrev = getSubjectAbbr(cls);

      return `
        <div class="class-box-card ${accentClass}" onclick="viewSubjectDetail(${cls.id}, 'assignments')">
          <div class="class-card-top">
            <div class="class-card-title-row">
              <div class="class-card-brand">
                <div class="class-card-icon ${iconThemeClass}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                  </svg>
                </div>
                <div class="class-card-heading">
                  <div class="class-title-code-wrap">
                    <span class="class-card-abbrev">${escapeHtml(abbrev)}</span>
                    ${cls.join_code ? `
                      <span class="class-join-code-badge" onclick="event.stopPropagation(); copyJoinCode('${escapeHtml(cls.join_code)}')" title="Click to copy join code">
                        <span>${escapeHtml(cls.join_code)}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                      </span>
                    ` : ''}
                  </div>
                  <p class="class-card-desc">${escapeHtml(cls.description || cls.name)}</p>
                </div>
              </div>
              <button class="class-card-more-btn" type="button" onclick="event.stopPropagation(); viewSubjectDetail(${cls.id}, 'overview')" title="Class options">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="class-card-stats-row">
            <div class="class-stat-box">
              <div class="class-stat-icon-wrap ${statIconClass}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div class="class-stat-info">
                <span class="class-stat-number">${cls.student_count || 0}</span>
                <span class="class-stat-label">Students</span>
              </div>
            </div>
            <div class="class-stat-box">
              <div class="class-stat-icon-wrap ${statIconClass}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div class="class-stat-info">
                <span class="class-stat-number">${cls.assignment_count || 0}</span>
                <span class="class-stat-label">Assignments</span>
              </div>
            </div>
          </div>

          <div class="class-card-bottom-actions">
            <button class="btn-class-students" type="button" onclick="event.stopPropagation(); viewSubjectDetail(${cls.id}, 'students')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <span>Students</span>
            </button>
            <button class="btn-class-assignments" type="button" onclick="event.stopPropagation(); viewSubjectDetail(${cls.id}, 'assignments')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Assignments</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 3. Clean empty-state card (displayed only when actual classes list is empty)
  const emptyStateHtml = `
    <div class="classes-empty-state-card" id="classesEmptyStateCard">
      <div class="classes-empty-icon-wrap">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
          <path d="M6 6h10"/>
          <path d="M6 10h10"/>
        </svg>
      </div>
      <h3 class="classes-empty-title">${isTeacher ? "No classes yet" : "No enrolled classes yet"}</h3>
      <p class="classes-empty-subtitle">${isTeacher ? "Get started by creating your first class to organize course subjects, share join codes with students, and track assignments." : "Join your first class using the 6-character code provided by your teacher."}</p>
      <button class="btn btn-primary classes-empty-action-btn" onclick="openClassesModal()" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>${isTeacher ? "Create Class" : "Join Class"}</span>
      </button>
    </div>
  `;

  // Combine into page content
  if (classes.length === 0) {
    elements.classesPageContent.innerHTML = `
      ${kpiHtml}
      ${emptyStateHtml}
    `;
  } else {
    elements.classesPageContent.innerHTML = `
      ${kpiHtml}
      ${toolbarHtml}
      <div class="classes-cards-grid" id="classesCardsGrid">
        ${renderCards(classes)}
      </div>
    `;
  }

  // Wire up search & filter & view toggling
  const searchInput = document.getElementById("classesSearchInput");
  const semesterFilter = document.getElementById("classesSemesterFilter");
  const gridContainer = document.getElementById("classesCardsGrid");
  const gridBtn = document.getElementById("classesViewGridBtn");
  const listBtn = document.getElementById("classesViewListBtn");

  function applyFilters() {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const semId = semesterFilter?.value || "";

    const filtered = classes.filter((c) => {
      const matchQuery = !q || (c.name && c.name.toLowerCase().includes(q)) ||
                               (c.description && c.description.toLowerCase().includes(q)) ||
                               (c.join_code && c.join_code.toLowerCase().includes(q));
      const matchSem = !semId || String(c.semester_id) === String(semId);
      return matchQuery && matchSem;
    });

    if (gridContainer) {
      gridContainer.innerHTML = renderCards(filtered);
    }
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (semesterFilter) semesterFilter.addEventListener("change", applyFilters);

  if (gridBtn && listBtn && gridContainer) {
    gridBtn.addEventListener("click", () => {
      gridBtn.classList.add("active");
      listBtn.classList.remove("active");
      gridContainer.classList.remove("list-view");
    });
    listBtn.addEventListener("click", () => {
      listBtn.classList.add("active");
      gridBtn.classList.remove("active");
      gridContainer.classList.add("list-view");
    });
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
          <div class="dash-metric-icon icon-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
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
          <div class="dash-metric-icon icon-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
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
 * Formats semester date range: e.g. "Jul - Dec 2024" or "1 Jul 2024 - 31 Dec 2024"
 */
function formatSemesterDateRange(startStr, endStr) {
  if (!startStr || !endStr) return "";
  try {
    const s = new Date(startStr + "T00:00:00Z");
    const e = new Date(endStr + "T00:00:00Z");
    const sMonth = s.toLocaleString("default", { month: "short", timeZone: "UTC" });
    const eMonth = e.toLocaleString("default", { month: "short", timeZone: "UTC" });
    const eYear = e.getUTCFullYear();
    return `${sMonth} – ${eMonth} ${eYear}`;
  } catch (err) {
    return `${startStr} - ${endStr}`;
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00Z"));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch (err) {
    return dateStr;
  }
}

/**
 * Fetches academic semesters from backend API
 */
async function fetchSemesters() {
  try {
    const res = await fetch(API_ENDPOINTS.semesters, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      state.semesters = await res.json();
      if (!state.activeSemesterId && state.semesters.length > 0) {
        const activeOne = state.semesters.find((s) => s.status === "active") || state.semesters[0];
        state.activeSemesterId = activeOne.id;
        state.activeSemester = activeOne;
      }
    }
  } catch (err) {
    console.error("Failed to fetch semesters:", err);
  }
}

function changeActiveSemester(semesterId) {
  state.activeSemesterId = parseInt(semesterId, 10);
  const found = state.semesters.find((s) => s.id === state.activeSemesterId);
  if (found) state.activeSemester = found;
  fetchDashboard();
}

/**
 * Fetches role-scoped dashboard metrics, cards, and donut data (Semester-aware)
 */
async function fetchDashboard() {
  try {
    // If user is a teacher, attempt to load semester-scoped dashboard
    if (state.currentUser?.role === "teacher") {
      if (!state.semesters || state.semesters.length === 0) {
        await fetchSemesters();
      }
      if (state.activeSemesterId) {
        const semRes = await fetch(`${API_ENDPOINTS.semesters}/${state.activeSemesterId}/dashboard`, {
          method: "GET",
          credentials: "same-origin",
          headers: getAuthHeaders(),
        });
        if (semRes.ok) {
          const semDashData = await semRes.json();
          renderSemesterDashboard(semDashData);
          return;
        }
      }
    }

    // Default or student dashboard fallback
    const res = await fetch(API_ENDPOINTS.dashboard, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
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
 * Helper to generate semester timeline month nodes
 */
function generateSemesterTimelineMonths(startDateStr, endDateStr) {
  const monthNames = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date("2026-06-01");
    const end = endDateStr ? new Date(endDateStr) : new Date("2026-12-31");
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid dates");
    }

    const result = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);
    const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    while (cur <= endLimit && result.length < 10) {
      const isCur = (cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth()) ||
                    (cur.getMonth() === 9 && cur.getFullYear() === 2026); // Default active on Oct 2026
      result.push({
        name: allMonths[cur.getMonth()],
        year: cur.getFullYear(),
        isCurrent: isCur,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    if (result.length > 0 && !result.some((m) => m.isCurrent)) {
      const mid = Math.min(4, Math.floor(result.length / 2));
      result[mid].isCurrent = true;
    }
    if (result.length > 0) return result;
  } catch (e) {
    // Fallback to reference screenshot
  }

  return [
    { name: "Jun", year: 2026, isCurrent: false },
    { name: "Jul", year: 2026, isCurrent: false },
    { name: "Aug", year: 2026, isCurrent: false },
    { name: "Sep", year: 2026, isCurrent: false },
    { name: "Oct", year: 2026, isCurrent: true },
    { name: "Nov", year: 2026, isCurrent: false },
    { name: "Dec", year: 2026, isCurrent: false },
  ];
}

/**
 * Renders Semester Overview Dashboard matching Screen 1 Reference
 */
function renderSemesterDashboard(dashData) {
  if (!dashData || !dashData.selected_semester) {
    fetch(API_ENDPOINTS.dashboard, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) renderDashboard(data);
      })
      .catch(console.error);
    return;
  }
  const sem = dashData.selected_semester;
  state.activeSemester = sem;
  state.activeSemesterId = sem.id;

  // 1. Hero Banner
  if (elements.dashGreeting) elements.dashGreeting.textContent = "Good morning,";
  if (elements.dashUserName) elements.dashUserName.textContent = state.currentUser?.full_name || "Rishi";
  if (elements.dashSubtitle) elements.dashSubtitle.textContent = "Here's an overview of your semester.";

  if (elements.dashRolePill) {
    elements.dashRolePill.style.display = "none";
  }

  // Right side of Hero: Semester Selector Dropdown Pill + Create Assignment Button
  const heroRight = document.querySelector(".dash-hero-right");
  if (heroRight) {
    const semOptions = (dashData.available_semesters || state.semesters || [sem])
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === sem.id ? "selected" : ""}>${escapeHtml(s.name)} (${formatSemesterDateRange(s.start_date, s.end_date)})</option>`
      )
      .join("");

    heroRight.innerHTML = `
      <div class="dash-header-tools">
        <div class="dash-semester-pill-wrap" title="Switch active semester">
          <svg class="dash-calendar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line>
          </svg>
          <select id="dashSemesterSelect" class="dash-semester-select" onchange="changeActiveSemester(this.value)">
            ${semOptions}
          </select>
          <svg class="dash-chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <button class="btn btn-primary dash-hero-cta" id="dashHeroCtaBtn" onclick="openDrawer()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span id="dashHeroCtaText">+ Create Assignment</span>
        </button>
      </div>
    `;
  }

  // 2. 4 Summary Metrics Row
  const stats = dashData.statistics || {};
  if (elements.dashMetricsRow) {
    elements.dashMetricsRow.innerHTML = `
      <div class="dash-metric-card" onclick="navigateToView('classes')" title="View subjects">
        <div class="dash-metric-icon icon-amber">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/><path d="M6 10h10"/>
          </svg>
        </div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${stats.subject_count || 0}</span>
          <span class="dash-metric-label">Subjects</span>
        </div>
        <div class="dash-metric-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>

      <div class="dash-metric-card" onclick="navigateToView('assignments')" title="View assignments">
        <div class="dash-metric-icon icon-amber">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="8" x2="16" y1="10" y2="10"/><line x1="8" x2="12" y1="14" y2="14"/>
          </svg>
        </div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${stats.assignment_count || 0}</span>
          <span class="dash-metric-label">Total Assignments</span>
        </div>
        <div class="dash-metric-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>

      <div class="dash-metric-card" onclick="navigateToView('submissions')" title="View submissions">
        <div class="dash-metric-icon icon-amber">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${stats.submission_count || 0}</span>
          <span class="dash-metric-label">Total Submissions</span>
        </div>
        <div class="dash-metric-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>

      <div class="dash-metric-card" onclick="navigateToView('reports')" title="View reports">
        <div class="dash-metric-icon icon-amber">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="9" stroke="rgba(217, 119, 6, 0.25)"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${stats.completion_rate_label || (stats.completion_rate + "%") || "0%"}</span>
          <span class="dash-metric-label">Average Completion</span>
        </div>
        <div class="dash-metric-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `;
  }

  // 3. Middle Row: 3 Columns (My Subjects, Submission Activity, Dark Charcoal Panel)
  // 3A. Left Column: My Subjects (Semester)
  const subjects = dashData.subjects || [];
  const subjectsHtml = subjects.map((sub, idx) => {
    const words = sub.name.trim().split(/\s+/);
    const shortCode = words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : sub.name.substring(0, 3).toUpperCase();
    const isEven = idx % 2 === 0;
    const barClass = isEven ? "accent-amber-top" : "accent-emerald-top";
    const iconClass = isEven ? "icon-amber" : "icon-emerald";
    const progress = Math.min(100, Math.max(0, Math.round(sub.submission_rate || 0)));

    return `
      <div class="dash-subject-tile ${barClass}" onclick="viewSubjectDetail(${sub.id})">
        <div class="dash-subject-tile-top">
          <div class="dash-subject-tile-brand">
            <div class="dash-subject-tile-icon ${iconClass}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                <path d="M6 6h10"/><path d="M6 10h10"/>
              </svg>
            </div>
            <div class="dash-subject-tile-info">
              <span class="dash-subject-tile-code">${escapeHtml(shortCode)}</span>
              <span class="dash-subject-tile-name">${escapeHtml(sub.name)}</span>
            </div>
          </div>
          <button class="dash-subject-more-btn" onclick="event.stopPropagation(); viewSubjectDetail(${sub.id})" title="Subject options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
        <div class="dash-subject-tile-meta">
          <span class="dash-subject-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="20" x="4" y="2" rx="2"/></svg>
            ${sub.assignments_count} Assignments
          </span>
          <span class="dash-subject-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${sub.students_count} Students
          </span>
        </div>
        <div class="dash-subject-tile-bar-wrap">
          <div class="dash-subject-tile-bar">
            <div class="dash-subject-tile-fill" style="width: ${progress}%;"></div>
          </div>
        </div>
        <div class="dash-subject-tile-footer">
          <span class="dash-subject-status-label">${progress}% completed</span>
          <div class="dash-subject-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (elements.dashMidLeftCard) {
    elements.dashMidLeftCard.style.gridColumn = "";
    elements.dashMidLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">My Subjects (${escapeHtml(sem.name)})</h2>
        <button class="dash-card-link" onclick="navigateToView('classes')">View all</button>
      </div>
      <div class="dash-subjects-scroll-list">
        ${subjectsHtml || '<div class="dash-empty-state"><p>No subjects added yet.</p><button class="btn btn-secondary btn-sm" onclick="openAddSubjectModal(' + sem.id + ')">+ Add First Subject</button></div>'}
      </div>
    `;
  }

  // 3B. Center Column: Submission Activity Chart
  if (elements.dashMidCenterCard) {
    elements.dashMidCenterCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Submission Activity</h2>
        <div class="dash-pill-filter">
          <span>This Month</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="dash-activity-chart-wrap">
        <svg class="dash-activity-svg" viewBox="0 0 320 180" preserveAspectRatio="none">
          <!-- Gridlines & Y-Axis Labels -->
          <line x1="30" y1="20" x2="310" y2="20" stroke="#EAE7DC" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="18" y="24" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500">4</text>

          <line x1="30" y1="55" x2="310" y2="55" stroke="#EAE7DC" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="18" y="59" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500">3</text>

          <line x1="30" y1="90" x2="310" y2="90" stroke="#EAE7DC" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="18" y="94" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500">2</text>

          <line x1="30" y1="125" x2="310" y2="125" stroke="#EAE7DC" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="18" y="129" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500">1</text>

          <line x1="30" y1="160" x2="310" y2="160" stroke="#EAE7DC" stroke-width="1.2"/>
          <text x="18" y="164" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500">0</text>

          <!-- Vertical week guidelines -->
          <line x1="75" y1="20" x2="75" y2="160" stroke="#F4F2EA" stroke-width="1"/>
          <line x1="145" y1="20" x2="145" y2="160" stroke="#F4F2EA" stroke-width="1"/>
          <line x1="215" y1="20" x2="215" y2="160" stroke="#F4F2EA" stroke-width="1"/>
          <line x1="285" y1="20" x2="285" y2="160" stroke="#F4F2EA" stroke-width="1"/>

          <!-- X-Axis Labels -->
          <text x="75" y="176" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500" text-anchor="middle">W1</text>
          <text x="145" y="176" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500" text-anchor="middle">W2</text>
          <text x="215" y="176" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500" text-anchor="middle">W3</text>
          <text x="285" y="176" font-size="11" fill="#74736D" font-family="system-ui" font-weight="500" text-anchor="middle">W4</text>

          <!-- Weekly activity status dots (Submitted #285747, Graded #252A28, Pending #F6E5B8) -->
          <circle cx="72" cy="158" r="4.5" fill="#285747"/>
          <circle cx="78" cy="158" r="4" fill="#F6E5B8"/>

          <circle cx="142" cy="158" r="4.5" fill="#285747"/>
          <circle cx="148" cy="158" r="4" fill="#F6E5B8"/>

          <circle cx="210" cy="158" r="4" fill="#F6E5B8"/>
          <circle cx="216" cy="158" r="4" fill="#252A28"/>

          <circle cx="282" cy="158" r="4.5" fill="#285747"/>
          <circle cx="288" cy="158" r="4" fill="#F6E5B8"/>
        </svg>
      </div>
      <div class="dash-activity-legend">
        <span class="activity-legend-item"><span class="legend-dot dot-submitted"></span> Submitted</span>
        <span class="activity-legend-item"><span class="legend-dot dot-graded"></span> Graded</span>
        <span class="activity-legend-item"><span class="legend-dot dot-pending"></span> Pending</span>
      </div>
    `;
  }

  // 3C. Right Column: Dark Contrast Charcoal Panel (Upcoming Deadlines & Quick Actions)
  const deadlines = dashData.upcoming_deadlines || [];
  const deadlinesHtml = deadlines.map((dl) => `
    <div class="dark-deadline-item" onclick="navigateToView('assignments')">
      <div class="dark-deadline-left">
        <div class="dark-calendar-icon-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line>
          </svg>
        </div>
        <div class="dark-deadline-texts">
          <span class="dark-deadline-title">${escapeHtml(dl.class_name)} – ${escapeHtml(dl.title)}</span>
          <span class="dark-deadline-date">${escapeHtml(dl.due_date)}</span>
        </div>
      </div>
      <span class="dark-pill-badge">${escapeHtml(dl.badge_label || (dl.days_left + " days left"))}</span>
      <button class="dark-chevron-btn" title="View assignment">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `).join("");

  if (elements.dashMidRightCard) {
    elements.dashMidRightCard.style.display = "flex";
    elements.dashMidRightCard.className = "dash-box-card dark-panel";
    elements.dashMidRightCard.innerHTML = `
      <!-- Upcoming Deadlines Section -->
      <div class="dark-panel-section">
        <div class="dark-section-header">
          <h2 class="dark-section-title">Upcoming Deadlines</h2>
          <button class="dark-section-link" onclick="navigateToView('assignments')">View all</button>
        </div>
        <div class="dark-deadlines-list">
          ${deadlinesHtml || '<div class="dark-empty-state"><p>No upcoming deadlines.</p></div>'}
        </div>
      </div>

      <!-- Quick Actions Section -->
      <div class="dark-panel-section">
        <div class="dark-section-header" style="margin-top: 0.5rem;">
          <h2 class="dark-section-title">Quick Actions</h2>
        </div>
        <div class="dark-quick-actions-list">
          <div class="dark-quick-action-item" onclick="openDrawer()">
            <div class="dark-qa-left">
              <div class="dark-qa-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              <div class="dark-qa-texts">
                <span class="dark-qa-title">Create Assignment</span>
                <span class="dark-qa-desc">Add a new assignment for your class</span>
              </div>
            </div>
            <div class="dark-chevron-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>

          <div class="dark-quick-action-item" onclick="navigateToView('classes')">
            <div class="dark-qa-left">
              <div class="dark-qa-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="dark-qa-texts">
                <span class="dark-qa-title">Manage Classes</span>
                <span class="dark-qa-desc">View and update your classes</span>
              </div>
            </div>
            <div class="dark-chevron-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>

          <div class="dark-quick-action-item" onclick="navigateToView('reports')">
            <div class="dark-qa-left">
              <div class="dark-qa-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              </div>
              <div class="dark-qa-texts">
                <span class="dark-qa-title">View Reports</span>
                <span class="dark-qa-desc">Check submissions and grading</span>
              </div>
            </div>
            <div class="dark-chevron-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 4. Bottom Row: 3 Columns (Recent Submissions, Grading Queue, Semester Timeline)
  // 4A. Left Column: Recent Submissions
  const recents = dashData.recent_submissions || [];
  let recentContent = "";
  if (recents.length > 0) {
    recentContent = recents.map((sub) => {
      const initial = (sub.student_name || "S").charAt(0).toUpperCase();
      return `
        <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('submissions')">
          <div class="dash-item-main">
            <div class="student-avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem;">${initial}</div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(sub.student_name)}</span>
              <span class="dash-item-sub">${escapeHtml(sub.class_name)} &bull; ${escapeHtml(sub.assignment_title)}</span>
            </div>
          </div>
          <div class="dash-item-meta">
            <span class="status-pill open">${escapeHtml(sub.status || "Submitted")}</span>
            <span style="font-size: 0.75rem; color: #74736D; font-weight: 500;">${escapeHtml(sub.relative_time)}</span>
          </div>
        </div>
      `;
    }).join("");
  } else {
    recentContent = `
      <div class="dash-empty-submissions">
        <svg class="empty-doc-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B5B3A8" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <h3 class="empty-submissions-title">No recent submissions.</h3>
        <p class="empty-submissions-desc">Student submissions will appear here once they start submitting assignments.</p>
      </div>
    `;
  }

  if (elements.dashBottomLeftCard) {
    elements.dashBottomLeftCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Recent Submissions</h2>
        <button class="dash-card-link" onclick="navigateToView('submissions')">View all</button>
      </div>
      <div class="dash-list">
        ${recentContent}
      </div>
    `;
  }

  // 4B. Center Column: Grading Queue
  const queueItems = (dashData.upcoming_deadlines || []).slice(0, 3);
  let queueHtml = "";
  if (queueItems.length > 0) {
    queueHtml = queueItems.map((item) => `
      <div class="dash-queue-item" onclick="navigateToView('submissions')">
        <div class="dash-queue-left">
          <div class="dash-queue-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line>
            </svg>
          </div>
          <div class="dash-queue-texts">
            <span class="dash-queue-title">${escapeHtml(item.class_name)} – ${escapeHtml(item.title)}</span>
            <span class="dash-queue-sub">${item.submissions_count || (item.days_left ? "0 submissions" : "2 submissions")}</span>
          </div>
        </div>
        <span class="dash-queue-pill">${escapeHtml(item.badge_label || (item.days_left + " days left"))}</span>
        <div class="dash-metric-chevron" style="width: 28px; height: 28px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    `).join("");
  } else {
    queueHtml = '<div class="dash-empty-state"><p>No items in grading queue.</p></div>';
  }

  if (elements.dashBottomCenterCard) {
    elements.dashBottomCenterCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Grading Queue</h2>
        <button class="dash-card-link" onclick="navigateToView('submissions')">View all</button>
      </div>
      <div class="dash-queue-list">
        ${queueHtml}
      </div>
    `;
  }

  // 4C. Right Column: Semester Timeline
  const months = generateSemesterTimelineMonths(sem.start_date, sem.end_date);
  const timelineNodesHtml = months.map((m) => `
    <div class="timeline-month-node ${m.isCurrent ? 'active' : ''}">
      <div class="timeline-dot-wrap">
        <div class="timeline-dot"></div>
      </div>
      <div class="timeline-month-label">
        <span class="t-month">${m.name}</span>
        <span class="t-year">${m.year}</span>
      </div>
      ${m.isCurrent ? '<span class="timeline-current-badge">Current</span>' : ''}
    </div>
  `).join("");

  if (elements.dashBottomRightCard) {
    elements.dashBottomRightCard.className = "dash-box-card";
    elements.dashBottomRightCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Semester Timeline</h2>
      </div>
      <div class="semester-timeline-container">
        <div class="semester-timeline-track">
          <div class="timeline-line"></div>
          <div class="timeline-nodes-row">
            ${timelineNodesHtml}
          </div>
        </div>
      </div>
    `;
  }

  if (elements.dashFullWidthWrap) {
    elements.dashFullWidthWrap.style.display = "none";
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
        { label: "Released", value: overview.released, color: "#24764B" },
        { label: "Draft", value: overview.draft, color: "#626963" },
        { label: "Ungraded", value: overview.ungraded, color: "#946200" },
        { label: "Late", value: overview.late, color: "#B42318" },
      ]);
    } else {
      renderDonutChart("teacherDonutContainer", overview.total, "Total", [
        { label: "Graded", value: overview.graded, color: "#24764B" },
        { label: "Pending", value: overview.pending, color: "#D9E8DF" },
        { label: "Late", value: overview.late, color: "#B42318" },
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
              <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">${formattedDate}</span>
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
        { label: "Pending", value: statusObj.pending, color: "#D9E8DF" },
        { label: "In Review", value: statusObj.pending_review, color: "#946200" },
        { label: "Released", value: statusObj.released, color: "#24764B" },
        { label: "Overdue", value: statusObj.overdue, color: "#B42318" },
      ]);
    } else {
      renderDonutChart("studentDonutContainer", statusObj.total, "Total", [
        { label: "Pending", value: statusObj.pending, color: "#D9E8DF" },
        { label: "Submitted", value: statusObj.submitted, color: "#24764B" },
        { label: "Overdue", value: statusObj.overdue, color: "#B42318" },
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAuthAlert("Please enter a valid email address.", "error");
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
    closeClassesModal();
    if (state.currentView === "classes") {
      loadClassesPageView();
    }
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
    closeClassesModal();
    if (state.currentView === "classes") {
      loadClassesPageView();
    }
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
    if (state.currentView === "classes") {
      loadClassesPageView();
    }
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

  // Release single button and Audit Correct button appearance
  if (elements.gradingReleaseSingleBtn) {
    if (sub.status === "released") {
      elements.gradingReleaseSingleBtn.textContent = "Grade Released";
      elements.gradingReleaseSingleBtn.disabled = true;
      if (elements.gradingAuditCorrectBtn) {
        elements.gradingAuditCorrectBtn.style.display = "inline-flex";
      }
    } else {
      elements.gradingReleaseSingleBtn.textContent = "Release Grade to Student";
      elements.gradingReleaseSingleBtn.disabled = false;
      if (elements.gradingAuditCorrectBtn) {
        elements.gradingAuditCorrectBtn.style.display = (sub.grade !== null && sub.grade !== undefined) ? "inline-flex" : "none";
      }
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

/**
 * Traps Tab focus navigation within a modal container
 */
function trapFocusInModal(e, container) {
  if (e.key !== "Tab" || !container) return;
  const focusable = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const firstElem = focusable[0];
  const lastElem = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstElem) {
      e.preventDefault();
      lastElem.focus();
    }
  } else {
    if (document.activeElement === lastElem) {
      e.preventDefault();
      firstElem.focus();
    }
  }
}

/**
 * Hides audit correction error messages
 */
function hideAuditErrors() {
  if (elements.auditGradeError) {
    elements.auditGradeError.textContent = "";
    elements.auditGradeError.style.display = "none";
  }
  if (elements.auditReasonError) {
    elements.auditReasonError.textContent = "";
    elements.auditReasonError.style.display = "none";
  }
}

/**
 * Shows error message on audit grade input
 */
function showAuditGradeError(msg) {
  if (elements.auditGradeError) {
    elements.auditGradeError.textContent = msg;
    elements.auditGradeError.style.display = "block";
  }
}

/**
 * Shows error message on audit reason input
 */
function showAuditReasonError(msg) {
  if (elements.auditReasonError) {
    elements.auditReasonError.textContent = msg;
    elements.auditReasonError.style.display = "block";
  }
}

/**
 * Opens Correct Grade (Audit Trail) Modal and populates current grade from active submission
 */
function openAuditCorrectModal() {
  if (state.currentGradingIndex < 0 || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  const assignment = state.currentGradingAssignment;
  const maxMarks = (assignment && assignment.max_marks !== undefined && assignment.max_marks !== null)
    ? assignment.max_marks
    : (sub && sub.max_marks !== undefined && sub.max_marks !== null ? sub.max_marks : 100);

  // Load actual saved grade correctly: read sub.grade first, or SpeedGrader input value
  let currentGradeVal = "—";
  if (sub && sub.grade !== null && sub.grade !== undefined && !isNaN(Number(sub.grade))) {
    currentGradeVal = sub.grade;
  } else if (elements.gradingMarksInput && elements.gradingMarksInput.value !== "" && !isNaN(Number(elements.gradingMarksInput.value))) {
    currentGradeVal = elements.gradingMarksInput.value;
  }

  if (elements.auditCurrentGradeVal) {
    elements.auditCurrentGradeVal.textContent = currentGradeVal;
  }
  if (elements.auditCurrentMaxMarks) {
    elements.auditCurrentMaxMarks.textContent = maxMarks;
  }
  if (elements.auditNewGradeMaxLabel) {
    elements.auditNewGradeMaxLabel.textContent = maxMarks;
  }
  if (elements.auditNewGradeInput) {
    elements.auditNewGradeInput.value = (currentGradeVal !== "—") ? currentGradeVal : "";
    elements.auditNewGradeInput.max = maxMarks;
  }
  if (elements.auditReasonInput) {
    elements.auditReasonInput.value = "";
  }
  hideAuditErrors();

  if (elements.auditCorrectModalBackdrop) {
    elements.auditCorrectModalBackdrop.style.display = "flex";
    if (elements.auditNewGradeInput) {
      elements.auditNewGradeInput.focus();
    }
  }
}

/**
 * Closes Correct Grade (Audit Trail) Modal
 */
function closeAuditCorrectModal() {
  if (elements.auditCorrectModalBackdrop) {
    elements.auditCorrectModalBackdrop.style.display = "none";
  }
  hideAuditErrors();
  if (elements.gradingAuditCorrectBtn) {
    elements.gradingAuditCorrectBtn.focus();
  }
}

/**
 * Submits corrected grade and audit trail reason to the server
 */
async function confirmAuditCorrect() {
  if (state.currentGradingIndex < 0 || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  const assignment = state.currentGradingAssignment;
  const maxMarks = (assignment && assignment.max_marks !== undefined && assignment.max_marks !== null)
    ? assignment.max_marks
    : 100;

  hideAuditErrors();

  const rawVal = elements.auditNewGradeInput ? elements.auditNewGradeInput.value.trim() : "";
  if (rawVal === "") {
    showAuditGradeError("Please enter a corrected grade.");
    return;
  }
  const newGrade = parseFloat(rawVal);
  if (isNaN(newGrade) || newGrade < 0) {
    showAuditGradeError("Grade must be a non-negative number.");
    return;
  }
  if (newGrade > maxMarks) {
    showAuditGradeError(`Grade cannot exceed max marks (${maxMarks}).`);
    return;
  }

  const reason = elements.auditReasonInput ? elements.auditReasonInput.value.trim() : "";
  if (!reason) {
    showAuditReasonError("Please provide an audit reason for this grade correction.");
    return;
  }

  const assignmentId = (assignment && assignment.id) || sub.assignment_id;
  const auditNote = `[Audit Correction: Grade adjusted to ${newGrade}/${maxMarks}. Reason: ${reason}]`;
  const updatedFeedback = sub.feedback ? `${sub.feedback}\n\n${auditNote}` : auditNote;

  if (elements.confirmAuditCorrectBtn) {
    elements.confirmAuditCorrectBtn.disabled = true;
    elements.confirmAuditCorrectBtn.textContent = "Saving...";
  }

  try {
    const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        grade: newGrade,
        feedback: updatedFeedback,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to update grade (HTTP ${res.status})`);
    }

    const updatedSub = await res.json();
    sub.grade = updatedSub.grade;
    sub.feedback = updatedSub.feedback;
    sub.status = updatedSub.status;

    // Update SpeedGrader UI inputs
    if (elements.gradingMarksInput) {
      elements.gradingMarksInput.value = updatedSub.grade;
    }
    if (elements.gradingFeedbackInput) {
      elements.gradingFeedbackInput.value = updatedSub.feedback || "";
    }
    updateWorkspaceStatusBadge(sub.status);

    showToast("Grade corrected and audit trail logged successfully.", "success");
    closeAuditCorrectModal();
    renderTeacherSubmissionsRoster();
  } catch (err) {
    console.error("Audit Correct error:", err);
    showAuditGradeError(err.message || "Failed to save grade correction.");
  } finally {
    if (elements.confirmAuditCorrectBtn) {
      elements.confirmAuditCorrectBtn.disabled = false;
      elements.confirmAuditCorrectBtn.textContent = "Save Correction";
    }
  }
}

/**
 * Opens Submission History & Archived Attempts Modal
 */
function openSubmissionHistoryModal() {
  if (state.currentGradingIndex < 0 || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  const assignment = state.currentGradingAssignment;
  const maxMarks = assignment && assignment.max_marks ? assignment.max_marks : 100;

  if (elements.historyStudentMeta) {
    elements.historyStudentMeta.textContent = `${sub.student_name} (${sub.student_email}) • ${assignment ? assignment.title : "Assignment"}`;
  }

  if (elements.historyAttemptsList) {
    const formattedDate = formatDisplayDateTime(sub.submitted_at);
    const gradeStr = (sub.grade !== null && sub.grade !== undefined)
      ? `${sub.grade} / ${maxMarks}`
      : "Ungraded";
    const assignmentId = (assignment && assignment.id) || sub.assignment_id;
    const downloadUrl = sub.download_url || `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/download`;

    elements.historyAttemptsList.innerHTML = `
      <div class="history-attempt-card">
        <div>
          <div class="history-attempt-title">Attempt 1 (Current Active Submission)</div>
          <div class="history-attempt-date">Submitted: ${formattedDate} • Status: ${sub.status}</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;"><strong>File:</strong> ${escapeHtml(sub.file_name || "submission")} (${formatBytes(sub.file_size)})</div>
          <div style="font-size: 0.85rem; color: var(--primary); margin-top: 0.25rem;"><strong>Grade:</strong> ${gradeStr}</div>
        </div>
        <div>
          <a class="btn btn-secondary btn-sm" href="${downloadUrl}" download="${escapeHtml(sub.file_name || "submission")}" target="_blank" rel="noopener">
            Download
          </a>
        </div>
      </div>
    `;
  }

  if (elements.submissionHistoryModalBackdrop) {
    elements.submissionHistoryModalBackdrop.style.display = "flex";
    if (elements.closeSubmissionHistoryBottomBtn) {
      elements.closeSubmissionHistoryBottomBtn.focus();
    }
  }
}

/**
 * Closes Submission History & Archived Attempts Modal
 */
function closeSubmissionHistoryModal() {
  if (elements.submissionHistoryModalBackdrop) {
    elements.submissionHistoryModalBackdrop.style.display = "none";
  }
  if (elements.gradingSubmissionHistoryBtn) {
    elements.gradingSubmissionHistoryBtn.focus();
  }
}

/**
 * Opens Authorize Resubmission Modal
 */
function openAuthorizeResubmissionModal() {
  if (state.currentGradingIndex < 0 || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];

  if (elements.authorizeResubmissionMessage) {
    elements.authorizeResubmissionMessage.innerHTML =
      `Authorizing a resubmission grants <strong>${escapeHtml(sub.student_name)}</strong> permission to upload a new attempt. Their existing attempt will be retained in history.`;
  }
  if (elements.resubmissionNotesInput) {
    elements.resubmissionNotesInput.value = "";
  }

  if (elements.authorizeResubmissionModalBackdrop) {
    elements.authorizeResubmissionModalBackdrop.style.display = "flex";
    if (elements.resubmissionNotesInput) {
      elements.resubmissionNotesInput.focus();
    }
  }
}

/**
 * Closes Authorize Resubmission Modal
 */
function closeAuthorizeResubmissionModal() {
  if (elements.authorizeResubmissionModalBackdrop) {
    elements.authorizeResubmissionModalBackdrop.style.display = "none";
  }
  if (elements.gradingAuthorizeResubmissionBtn) {
    elements.gradingAuthorizeResubmissionBtn.focus();
  }
}

/**
 * Confirms Authorize Resubmission
 */
function confirmAuthorizeResubmission() {
  if (state.currentGradingIndex < 0 || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];

  showToast(`Resubmission authorized for ${sub.student_name}.`, "success");
  closeAuthorizeResubmissionModal();
}

/* ================================================================ */
/* SEMESTER MANAGEMENT (Screen 2 Reference)                         */
/* ================================================================ */

/**
 * Loads and renders the Semesters page matching the reference mockup
 */
async function loadSemestersPageView() {
  const container = document.getElementById("semestersListContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state-card" style="padding: 2.5rem; text-align: center;">
      <div class="spinner"></div>
      <p style="margin-top: 0.75rem; color: #64748b;">Loading academic semesters...</p>
    </div>
  `;

  await Promise.all([fetchSemesters(), fetchClasses()]);

  // Update KPI Metrics Cards
  const allSemesters = state.semesters || [];
  const now = new Date();
  const totalCount = allSemesters.length;
  const activeCount = allSemesters.filter(s => s.status === "active").length;
  const upcomingCount = allSemesters.filter(s => s.status === "upcoming" || (!s.is_finalized && s.start_date && new Date(s.start_date) > now)).length;
  const completedCount = allSemesters.filter(s => s.status === "completed" || s.is_finalized).length;

  const kpiTotal = document.getElementById("semKpiTotalCount");
  const kpiActive = document.getElementById("semKpiActiveCount");
  const kpiUpcoming = document.getElementById("semKpiUpcomingCount");
  const kpiCompleted = document.getElementById("semKpiCompletedCount");

  if (kpiTotal) kpiTotal.textContent = totalCount;
  if (kpiActive) kpiActive.textContent = activeCount;
  if (kpiUpcoming) kpiUpcoming.textContent = upcomingCount;
  if (kpiCompleted) kpiCompleted.textContent = completedCount;

  // Render Table with current search/filter
  renderFilteredSemesters();

  // Attach search and filter event listeners if not already attached
  initSemestersFilterListeners();
}

let semestersFiltersInitialized = false;
function initSemestersFilterListeners() {
  if (semestersFiltersInitialized) return;
  semestersFiltersInitialized = true;

  const searchInput = document.getElementById("semestersSearchInput");
  const statusFilter = document.getElementById("semestersStatusFilter");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderFilteredSemesters();
    });
  }
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      renderFilteredSemesters();
    });
  }
}

function filterSemestersByStatus(status) {
  const statusFilter = document.getElementById("semestersStatusFilter");
  if (statusFilter) {
    statusFilter.value = status;
    renderFilteredSemesters();
  }
  const section = document.getElementById("existingSemestersSection");
  if (section) section.scrollIntoView({ behavior: "smooth" });
}

function renderFilteredSemesters() {
  const container = document.getElementById("semestersListContainer");
  if (!container) return;

  const allSemesters = state.semesters || [];
  const searchInput = document.getElementById("semestersSearchInput");
  const statusFilter = document.getElementById("semestersStatusFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const selectedStatus = statusFilter ? statusFilter.value : "all";
  const now = new Date();

  const filtered = allSemesters.filter(sem => {
    // Status Filter
    if (selectedStatus !== "all") {
      let currentStatus = sem.status;
      if (sem.is_finalized || sem.status === "completed") {
        currentStatus = "completed";
      } else if (sem.status === "upcoming" || (!sem.is_finalized && sem.start_date && new Date(sem.start_date) > now)) {
        currentStatus = "upcoming";
      } else if (sem.status === "active") {
        currentStatus = "active";
      }
      if (currentStatus !== selectedStatus) return false;
    }

    // Search Query
    if (query) {
      const matchName = (sem.name || "").toLowerCase().includes(query);
      const matchYear = (sem.academic_year || "").toLowerCase().includes(query);
      const matchProgram = (sem.program || "").toLowerCase().includes(query);
      const matchStart = (sem.start_date || "").toLowerCase().includes(query);
      const matchEnd = (sem.end_date || "").toLowerCase().includes(query);
      if (!matchName && !matchYear && !matchProgram && !matchStart && !matchEnd) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: #737373;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #A3A3A3; margin-bottom: 0.5rem; display: inline-block;">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" x2="6"/>
          <line x1="8" x2="8" y1="2" x2="6"/>
          <line x1="3" x2="21" y1="10" x2="10"/>
        </svg>
        <p style="font-weight: 600; color: #171717; margin-bottom: 0.25rem;">No semesters found</p>
        <p style="font-size: 0.85rem; color: #737373;">Try adjusting your search query or status filter.</p>
      </div>
    `;
    return;
  }

  // Render Table
  const rowsHtml = filtered.map(sem => {
    let statusKey = "active";
    let statusLabel = "Active";
    if (sem.status === "completed" || sem.is_finalized) {
      statusKey = "completed";
      statusLabel = "Completed";
    } else if (sem.status === "upcoming" || (!sem.is_finalized && sem.start_date && new Date(sem.start_date) > now)) {
      statusKey = "upcoming";
      statusLabel = "Upcoming";
    } else if (sem.status === "archived") {
      statusKey = "archived";
      statusLabel = "Archived";
    } else {
      statusKey = "active";
      statusLabel = "Active";
    }

    const startFmt = formatShortDate(sem.start_date);
    const endFmt = formatShortDate(sem.end_date);
    const dateRange = (startFmt && endFmt) ? `${startFmt} - ${endFmt}` : "—";
    const classesCount = (state.classes || []).filter(c => c.semester_id === sem.id).length || sem.classes_count || 0;
    const subjectsCount = sem.subjects_count || 0;

    return `
      <tr class="sem-table-row" id="semesterRow-${sem.id}">
        <td class="col-sem-name">
          <div class="sem-name-cell">
            <div class="sem-book-icon-box" title="Academic Semester">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                <path d="M6 6h10"></path>
                <path d="M6 10h10"></path>
              </svg>
            </div>
            <div class="sem-title-wrap">
              <span class="sem-row-title" onclick="openSemesterDashboard(${sem.id})" title="Open semester dashboard">${escapeHtml(sem.name)}</span>
            </div>
          </div>
        </td>
        <td class="col-sem-year">${escapeHtml(sem.academic_year || "2025 - 2026")}</td>
        <td class="col-sem-dates">${dateRange}</td>
        <td class="col-sem-status">
          <span class="sem-status-badge status-${statusKey}">${statusLabel}</span>
        </td>
        <td class="col-sem-num">${subjectsCount}</td>
        <td class="col-sem-num">${classesCount}</td>
        <td class="col-sem-actions">
          <div class="sem-row-actions-group">
            <button class="sem-btn-edit" type="button" onclick="openEditSemesterModal(${sem.id})" title="Edit semester">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
            <div class="academic-menu-wrap" style="position: relative; display: inline-block;">
              <button class="sem-btn-more" type="button" title="More options" onclick="toggleSemesterMenu(event, ${sem.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
              <div class="academic-menu-dropdown" id="semMenu-${sem.id}" style="display: none; position: absolute; right: 0; top: 100%; z-index: 50; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); min-width: 175px; padding: 6px 0;">
                <button class="academic-menu-item" onclick="openSemesterDashboard(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  View Dashboard
                </button>
                <button class="academic-menu-item" onclick="openSemesterReportView(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Performance Report
                </button>
                <button class="academic-menu-item" onclick="openAddSubjectModal(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Subject
                </button>
                <button class="academic-menu-item" onclick="openEditSemesterModal(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Semester
              </button>
              ${!sem.is_finalized ? `
                <button class="academic-menu-item" onclick="handleFinalizeSemester(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  Finalize Semester
                </button>
              ` : ""}
              ${sem.status !== "archived" ? `
                <button class="academic-menu-item" onclick="handleArchiveSemester(${sem.id})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect width="22" height="5" x="1" y="3"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                  Archive Semester
                </button>
              ` : ""}
              <button class="academic-menu-item danger" onclick="handleDeleteSemester(${sem.id}, '${escapeHtml(sem.name)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                Delete Semester
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
  }).join("");

  container.innerHTML = `
    <div class="sem-table-responsive">
      <table class="sem-table">
        <thead>
          <tr>
            <th class="col-sem-name">SEMESTER NAME</th>
            <th class="col-sem-year">ACADEMIC YEAR</th>
            <th class="col-sem-dates">DATES</th>
            <th class="col-sem-status">STATUS</th>
            <th class="col-sem-num">SUBJECTS</th>
            <th class="col-sem-num">CLASSES</th>
            <th class="col-sem-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody id="semestersTableBody">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function toggleSemesterMenu(event, semId) {
  event.stopPropagation();
  const menu = document.getElementById(`semMenu-${semId}`);
  const isShown = menu && menu.style.display === "block";
  document.querySelectorAll(".academic-menu-dropdown").forEach(m => m.style.display = "none");
  if (menu && !isShown) {
    menu.style.display = "block";
  }
}

document.addEventListener("click", () => {
  document.querySelectorAll(".academic-menu-dropdown").forEach(m => m.style.display = "none");
});

function openSemesterDashboard(semId) {
  state.activeSemesterId = semId;
  const found = (state.semesters || []).find(s => s.id === semId);
  if (found) state.activeSemester = found;
  navigateToView("dashboard");
}

async function handleCreateSemesterInline(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("newSemName")?.value?.trim();
  const academic_year = document.getElementById("newSemYear")?.value?.trim();
  const start_date = document.getElementById("newSemStartDate")?.value;
  const end_date = document.getElementById("newSemEndDate")?.value;

  if (!name || !academic_year || !start_date || !end_date) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (new Date(end_date) <= new Date(start_date)) {
    showToast("End date must be strictly after start date.", "error");
    return;
  }

  try {
    const res = await fetch(API_ENDPOINTS.semesters, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        academic_year,
        start_date,
        end_date,
        program: "B.Tech CSE",
        status: "active",
      }),
    });

    if (res.ok) {
      const created = await res.json();
      showToast(`Semester "${created.name}" created successfully!`, "success");
      const form = document.getElementById("createSemesterInlineForm");
      if (form) form.reset();
      state.activeSemesterId = created.id;
      state.activeSemester = created;
      await loadSemestersPageView();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Failed to create semester.", "error");
    }
  } catch (err) {
    console.error("Create semester error:", err);
    showToast("Network error creating semester.", "error");
  }
}

function openEditSemesterModal(semesterId) {
  const sem = (state.semesters || []).find((s) => s.id === semesterId);
  if (!sem) return;

  const idInput = document.getElementById("editSemId");
  const nameInput = document.getElementById("editSemName");
  const yearSelect = document.getElementById("editSemYear");
  const startInput = document.getElementById("editSemStartDate");
  const endInput = document.getElementById("editSemEndDate");
  const statusSelect = document.getElementById("editSemStatus");

  if (idInput) idInput.value = sem.id;
  if (nameInput) nameInput.value = sem.name;
  if (yearSelect) yearSelect.value = sem.academic_year;
  if (startInput) startInput.value = sem.start_date;
  if (endInput) endInput.value = sem.end_date;
  if (statusSelect) statusSelect.value = sem.status;

  const modal = document.getElementById("editSemesterModalBackdrop");
  if (modal) modal.style.display = "flex";
}

function closeEditSemesterModal() {
  const modal = document.getElementById("editSemesterModalBackdrop");
  if (modal) modal.style.display = "none";
}

async function handleSaveEditSemester(e) {
  if (e) e.preventDefault();
  const id = document.getElementById("editSemId")?.value;
  const name = document.getElementById("editSemName")?.value?.trim();
  const academic_year = document.getElementById("editSemYear")?.value;
  const start_date = document.getElementById("editSemStartDate")?.value;
  const end_date = document.getElementById("editSemEndDate")?.value;
  const statusVal = document.getElementById("editSemStatus")?.value;

  if (!id || !name || !start_date || !end_date) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (new Date(end_date) <= new Date(start_date)) {
    showToast("End date must be strictly after start date.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${id}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        academic_year,
        start_date,
        end_date,
        status: statusVal,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      showToast(`Semester "${updated.name}" updated successfully!`, "success");
      closeEditSemesterModal();
      await fetchSemesters();
      if (state.currentView === "semesters") {
        await loadSemestersPageView();
      } else if (state.currentView === "dashboard") {
        fetchDashboard();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Failed to update semester.", "error");
    }
  } catch (err) {
    console.error("Save semester error:", err);
    showToast("Error updating semester.", "error");
  }
}

async function handleArchiveSemester(semesterId) {
  if (!confirm("Are you sure you want to archive this semester? Its academic records will be preserved safely.")) return;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}/archive`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      showToast("Semester successfully archived.", "success");
      await fetchSemesters();
      if (state.currentView === "semesters") loadSemestersPageView();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Failed to archive semester.", "error");
    }
  } catch (err) {
    showToast("Error archiving semester.", "error");
  }
}

async function handleFinalizeSemester(semesterId) {
  if (!confirm("Finalize semester results? This marks official grades for all subjects. All assessments must be graded and released.")) return;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}/finalize`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const updated = await res.json();
      showToast(`Semester "${updated.name}" finalized successfully!`, "success");
      await fetchSemesters();
      if (state.currentView === "reports") {
        renderSemesterReport(semesterId);
      } else if (state.currentView === "semesters") {
        loadSemestersPageView();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Cannot finalize semester.", "error");
    }
  } catch (err) {
    showToast("Error finalizing semester.", "error");
  }
}

async function handleDeleteSemester(semesterId, semName) {
  if (!confirm(`Are you sure you want to delete semester "${semName}"?\nNote: Semesters with existing subjects or submissions cannot be deleted and must be archived.`)) return;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      showToast(`Semester "${semName}" deleted.`, "success");
      if (state.activeSemesterId === semesterId) {
        state.activeSemesterId = null;
        state.activeSemester = null;
      }
      await fetchSemesters();
      loadSemestersPageView();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Cannot delete semester with academic records. Please archive instead.", "warning");
    }
  } catch (err) {
    showToast("Error deleting semester.", "error");
  }
}

function openAddSubjectModal(semesterId) {
  const semId = semesterId || state.activeSemesterId;
  const semInput = document.getElementById("addSubjectSemId");
  const nameInput = document.getElementById("addSubjectName");
  const descInput = document.getElementById("addSubjectDesc");

  if (semInput) semInput.value = semId || "";
  if (nameInput) nameInput.value = "";
  if (descInput) descInput.value = "";

  const modal = document.getElementById("addSubjectModalBackdrop");
  if (modal) {
    modal.style.display = "flex";
    if (nameInput) nameInput.focus();
  }
}

function closeAddSubjectModal() {
  const modal = document.getElementById("addSubjectModalBackdrop");
  if (modal) modal.style.display = "none";
}

async function handleSubmitAddSubject(e) {
  if (e) e.preventDefault();
  const semId = document.getElementById("addSubjectSemId")?.value || state.activeSemesterId;
  const name = document.getElementById("addSubjectName")?.value?.trim();
  const description = document.getElementById("addSubjectDesc")?.value?.trim() || "";

  if (!name) {
    showToast("Please enter a subject name or code.", "error");
    return;
  }

  try {
    let url = API_ENDPOINTS.classes;
    if (semId) {
      url = `${API_ENDPOINTS.semesters}/${semId}/subjects`;
    }

    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        semester_id: semId ? parseInt(semId, 10) : null,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      showToast(`Subject "${created.name}" created successfully! Join code: ${created.join_code}`, "success");
      closeAddSubjectModal();
      await fetchClasses();
      if (state.currentView === "dashboard") {
        fetchDashboard();
      } else if (state.currentView === "classes") {
        loadClassesPageView();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Failed to create subject.", "error");
    }
  } catch (err) {
    console.error("Submit subject error:", err);
    showToast("Error creating subject.", "error");
  }
}

/* ================================================================ */
/* SUBJECT & ASSIGNMENTS WITHIN SEMESTER (Screen 3 & 4 Reference)    */
/* ================================================================ */

async function viewSubjectDetail(subjectId, activeTab = "assignments") {
  state.activeSubjectId = parseInt(subjectId, 10);
  state.activeSubjectTab = activeTab;
  navigateToView("classes");
}

async function renderSubjectDetailView() {
  if (!elements.classesPageContent || !state.activeSubjectId) return;

  const subjectId = state.activeSubjectId;
  let subject = (state.classes || []).find((c) => c.id === subjectId);

  if (!subject) {
    try {
      const res = await fetch(`${API_ENDPOINTS.classes}/${subjectId}`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        subject = await res.json();
        if (state.classes && !state.classes.some((c) => c.id === subject.id)) {
          state.classes.push(subject);
          populateFormClassOptions(state.classes);
        }
      }
    } catch (e) {
      console.error("Error fetching subject details:", e);
    }
  }

  if (!subject) {
    state.activeSubjectId = null;
    state.activeSubject = null;
    loadClassesPageView();
    return;
  }

  state.activeSubject = subject;
  if (subject.semester_id && !state.activeSemesterId) {
    state.activeSemesterId = subject.semester_id;
  }

  const semName = state.activeSemester?.name || "Semester 5";
  const activeTab = state.activeSubjectTab || "assignments";

  if (activeTab === "students") {
    // Screen 4: Student Performance (Subject-wise)
    elements.classesPageContent.innerHTML = `
      <div class="subject-detail-container">
        <!-- Breadcrumbs (Screen 4) -->
        <nav class="academic-breadcrumbs" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li class="breadcrumb-item"><a href="#semesters" onclick="navigateToView('semesters'); return false;">Semesters</a></li>
            <li class="breadcrumb-separator">›</li>
            <li class="breadcrumb-item"><a href="#dashboard" onclick="navigateToView('dashboard'); return false;">${escapeHtml(semName)}</a></li>
            <li class="breadcrumb-separator">›</li>
            <li class="breadcrumb-item"><a href="javascript:void(0)" onclick="viewSubjectDetail(${subject.id}, 'assignments')">${escapeHtml(subject.name)}</a></li>
            <li class="breadcrumb-separator">›</li>
            <li class="breadcrumb-item active">Students</li>
          </ol>
        </nav>

        <!-- Page Header (Screen 4) -->
        <div class="page-header-row" style="margin-top: 0.5rem;">
          <div class="page-header-left">
            <h1 class="page-title">Students – ${escapeHtml(subject.name)}</h1>
            <p class="page-subtitle">View submissions, grades and performance for this subject.</p>
          </div>
          <div class="page-header-actions">
            <button class="btn btn-secondary" onclick="exportSubjectStudentsCsv(${subject.id}, '${escapeHtml(subject.name)}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
            </button>
            <button class="btn btn-primary" onclick="showToast('Reminders dispatched to students with pending submissions.', 'success')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span>Send Reminder</span>
            </button>
            <button class="btn btn-outline" onclick="exitSubjectDetail()">
              <span>&larr; All Subjects</span>
            </button>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="subject-tabs-nav">
          <button class="subject-tab-btn" onclick="viewSubjectDetail(${subject.id}, 'overview')">Overview</button>
          <button class="subject-tab-btn" onclick="viewSubjectDetail(${subject.id}, 'assignments')">Assignments</button>
          <button class="subject-tab-btn active" onclick="viewSubjectDetail(${subject.id}, 'students')">Students</button>
          <button class="subject-tab-btn" onclick="viewSubjectDetail(${subject.id}, 'analytics')">Analytics</button>
        </div>

        <div id="subjectStudentsTableWrap" class="academic-table-card" style="margin-top: 1rem;">
          <div class="loading-state-card" style="padding: 2rem;"><div class="spinner"></div><p>Loading student performance...</p></div>
        </div>
      </div>
    `;

    try {
      const semId = subject.semester_id || state.activeSemesterId;
      let perfData = null;
      if (semId) {
        const perfRes = await fetch(`${API_ENDPOINTS.semesters}/${semId}/subjects/${subject.id}/performance`, {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (perfRes.ok) {
          perfData = await perfRes.json();
        }
      }

      const tableWrap = document.getElementById("subjectStudentsTableWrap");
      if (!tableWrap) return;

      const students = perfData?.students || [];
      if (students.length === 0) {
        tableWrap.innerHTML = `
          <div class="dash-empty-state" style="padding: 3rem 1rem;">
            <p>No students enrolled in this subject yet. Share join code <strong>${escapeHtml(subject.join_code)}</strong> with your students.</p>
          </div>
        `;
        return;
      }

      const rowsHtml = students.map((st, idx) => {
        const initial = (st.student_name || "S").charAt(0).toUpperCase();
        const statusClass = st.status === "On Track" ? "open" : (st.status === "At Risk" ? "warning" : "info");
        return `
          <tr>
            <td style="color: #64748b; font-weight: 500;">${idx + 1}</td>
            <td>
              <div class="student-table-user-cell">
                <div class="student-avatar-circle">${initial}</div>
                <div>
                  <div style="font-weight: 600; color: #1e293b;">${escapeHtml(st.student_name)}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${escapeHtml(st.email || "")}</div>
                </div>
              </div>
            </td>
            <td style="font-weight: 600;">${st.completed_submissions} / ${st.total_assignments}</td>
            <td style="font-weight: 700; color: #0f172a;">${escapeHtml(st.average_score_pct)}</td>
            <td>
              <span class="status-pill ${statusClass}">${escapeHtml(st.status)}</span>
            </td>
            <td>
              <button class="academic-menu-btn" title="Student options" onclick="showToast('Viewing student record for ${escapeHtml(st.student_name)}', 'info')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      tableWrap.innerHTML = `
        <table class="academic-table">
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Student Name</th>
              <th>Submissions</th>
              <th>Average Score</th>
              <th>Status</th>
              <th style="width: 60px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error("Student performance load error:", err);
    }
    return;
  }

  // Screen 3: Subject and Assignments (Within a Semester)
  elements.classesPageContent.innerHTML = `
    <div class="subject-detail-container">
      <!-- Breadcrumbs (Screen 3) -->
      <nav class="academic-breadcrumbs" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          <li class="breadcrumb-item"><a href="#semesters" onclick="navigateToView('semesters'); return false;">Semesters</a></li>
          <li class="breadcrumb-separator">›</li>
          <li class="breadcrumb-item"><a href="#dashboard" onclick="navigateToView('dashboard'); return false;">${escapeHtml(semName)}</a></li>
          <li class="breadcrumb-separator">›</li>
          <li class="breadcrumb-item active">${escapeHtml(subject.name)}</li>
        </ol>
      </nav>

      <!-- Page Header (Screen 3) -->
      <div class="page-header-row" style="margin-top: 0.5rem;">
        <div class="page-header-left">
          <h1 class="page-title">${escapeHtml(subject.name)}</h1>
          <p class="page-subtitle">${escapeHtml(subject.description || "Core Course Subject")}</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="openCreateAssignmentForSubject(${subject.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>+ Create Assignment</span>
          </button>
          <button class="btn btn-outline" onclick="exitSubjectDetail()">
            <span>&larr; All Subjects</span>
          </button>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="subject-tabs-nav">
        <button class="subject-tab-btn ${activeTab === 'overview' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'overview')">Overview</button>
        <button class="subject-tab-btn ${activeTab === 'assignments' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'assignments')">Assignments</button>
        <button class="subject-tab-btn ${activeTab === 'students' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'students')">Students</button>
        <button class="subject-tab-btn ${activeTab === 'analytics' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'analytics')">Analytics</button>
      </div>

      <div id="subjectTabContentWrap" style="margin-top: 1.25rem;">
        <div class="loading-state-card" style="padding: 2rem;"><div class="spinner"></div><p>Loading assignments...</p></div>
      </div>
    </div>
  `;

  const contentWrap = document.getElementById("subjectTabContentWrap");
  if (!contentWrap) return;

  if (activeTab === "overview") {
    contentWrap.innerHTML = `
      <div class="academic-table-card" style="padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #0f172a;">Course Overview</h3>
        <p style="color: #64748b; margin-bottom: 1.25rem;">${escapeHtml(subject.description || "No description provided.")}</p>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Student Join Code</span>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary); margin-top: 0.25rem; cursor: pointer;" onclick="copyJoinCode('${escapeHtml(subject.join_code)}')">
              ${escapeHtml(subject.join_code)}
            </div>
          </div>
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Enrolled Students</span>
            <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${subject.student_count || 0}</div>
          </div>
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Assignments</span>
            <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">${subject.assignment_count || 0}</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (activeTab === "analytics") {
    contentWrap.innerHTML = `
      <div class="academic-table-card" style="padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #0f172a;">Subject Analytics</h3>
        <p style="color: #64748b; margin-bottom: 1.25rem;">Tracking assignment submission rates and grading completion.</p>
        <div style="display: flex; gap: 2rem;">
          <div><span style="color: #64748b;">Active Assessments:</span> <strong>${subject.assignment_count || 0}</strong></div>
          <div><span style="color: #64748b;">Class Size:</span> <strong>${subject.student_count || 0} Students</strong></div>
        </div>
      </div>
    `;
    return;
  }

  // Active tab is "assignments" (Screen 3)
  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}?class_id=${subject.id}`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const assignments = await res.json();
      if (assignments.length === 0) {
        contentWrap.innerHTML = `
          <div class="dash-empty-state" style="padding: 3rem 1rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
            <p>No assignments created for ${escapeHtml(subject.name)} yet.</p>
            <button class="btn btn-primary" onclick="openCreateAssignmentForSubject(${subject.id})" style="margin-top: 1rem;">
              + Create First Assignment
            </button>
          </div>
        `;
        return;
      }

      const rowsHtml = assignments.map((as, idx) => {
        const dueDateFormatted = formatShortDate(as.due_date);
        const typeLabel = as.assignment_type || "Assignment";
        const isDraft = as.status === "draft";
        const isClosed = as.status === "closed";
        const isOpen = as.status === "active" || as.status === "open";
        const statusClass = isOpen ? "open" : (isDraft ? "draft" : (isClosed ? "danger" : "info"));
        const statusLabel = isOpen ? "Open" : (isDraft ? "Draft" : (isClosed ? "Closed" : "Scheduled"));
        const submissionDisplay = isDraft ? "-" : `${as.submission_count || 0} / ${as.total_students || subject.student_count || '-'}`;

        return `
          <tr>
            <td style="color: #64748b; font-weight: 500;">${idx + 1}</td>
            <td style="font-weight: 600; color: #1e293b;">
              <span style="cursor: pointer;" onclick="openTeacherSubmissionsModal(${as.id}, '${escapeHtml(as.title)}')">${escapeHtml(as.title)}</span>
            </td>
            <td><span class="type-pill">${escapeHtml(typeLabel)}</span></td>
            <td style="color: #475569; font-weight: 500;">${dueDateFormatted}</td>
            <td style="font-weight: 600; color: #1e293b;">${submissionDisplay}</td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>
              <button class="academic-menu-btn" title="Assignment options" onclick="openTeacherSubmissionsModal(${as.id}, '${escapeHtml(as.title)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      contentWrap.innerHTML = `
        <div class="academic-table-card">
          <table class="academic-table">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Assignment Title</th>
                <th>Type</th>
                <th>Due Date</th>
                <th>Submissions</th>
                <th>Status</th>
                <th style="width: 60px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    console.error("Subject assignments fetch error:", err);
  }
}

function exitSubjectDetail() {
  state.activeSubjectId = null;
  state.activeSubject = null;
  state.activeSubjectTab = null;
  loadClassesPageView();
}

function openCreateAssignmentForSubject(subjectId = null, subjectName = null, semesterId = null) {
  const sid = parseInt(subjectId || state.activeSubjectId, 10);
  let cls = (state.classes || []).find((c) => c.id === sid) || state.activeSubject;
  const finalSubjectName = subjectName || (cls ? cls.name : "") || (state.activeSubject ? state.activeSubject.name : "");
  const finalSemesterId = (semesterId !== null && semesterId !== undefined && String(semesterId) !== "null")
    ? parseInt(semesterId, 10)
    : (cls ? cls.semester_id : null);

  state.activeSubjectId = sid;
  if (cls) state.activeSubject = cls;

  openDrawer(null, {
    type: finalSemesterId ? "semester_subject" : "class",
    subjectId: sid,
    subjectName: finalSubjectName,
    semesterId: finalSemesterId,
  });
}
window.openCreateAssignmentForSubject = openCreateAssignmentForSubject;

function openCreateAssignmentForClass(classId = null, className = null, semesterId = null) {
  const cid = parseInt(classId, 10);
  const cls = (state.classes || []).find((c) => c.id === cid);
  const finalClassName = className || (cls ? cls.name : `Class #${cid}`);
  const finalSemesterId = (semesterId !== null && semesterId !== undefined && String(semesterId) !== "null")
    ? parseInt(semesterId, 10)
    : (cls ? cls.semester_id : null);

  openDrawer(null, {
    type: finalSemesterId ? "semester_subject" : "class",
    classId: cid,
    className: finalClassName,
    semesterId: finalSemesterId,
    isSubjectLocked: false,
  });
}
window.openCreateAssignmentForClass = openCreateAssignmentForClass;

/* ================================================================ */
/* SEMESTER-LEVEL REPORT (Screen 5 Reference)                       */
/* ================================================================ */

async function loadReportsPageView() {
  if (!state.semesters || state.semesters.length === 0) {
    await fetchSemesters();
  }
  const semId = state.activeSemesterId || (state.semesters && state.semesters[0]?.id);
  if (!semId) {
    if (elements.reportsView) {
      elements.reportsView.innerHTML = `
        <div class="dash-empty-state" style="padding: 3rem 1rem; text-align: center;">
          <p>No semesters found to generate a report. Please create a semester first.</p>
        </div>
      `;
    }
    return;
  }
  renderSemesterReport(semId);
}

async function renderSemesterReport(semesterId) {
  const semId = semesterId || state.activeSemesterId;
  if (!semId) return;

  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semId}/report`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      showToast("Failed to load semester report.", "error");
      return;
    }

    const report = await res.json();
    state.activeSemesterId = report.semester_id;

    const semTitle = report.semester_name || "Semester 5";
    if (elements.reportTitle) {
      elements.reportTitle.textContent = `${semTitle} – Performance Report`;
    }
    if (elements.reportSubtitle) {
      elements.reportSubtitle.textContent = `Overall performance across all subjects. (${report.academic_year || "2024 - 2025"})`;
    }

    const banner = document.getElementById("reportStatusBanner");
    if (banner) {
      banner.style.display = "flex";
      if (report.is_finalized) {
        banner.className = "report-status-banner finalized";
        banner.innerHTML = `
          <span><strong>✓ Official Finalized Academic Report:</strong> Results confirmed by ${escapeHtml(report.finalized_by_name || "Authorized Teacher")} on ${formatShortDate(report.finalized_at)}.</span>
          <span class="status-pill open">Final</span>
        `;
      } else {
        banner.className = "report-status-banner provisional";
        banner.innerHTML = `
          <span><strong>Provisional Report:</strong> In-progress assessments are calculated without treating missing work as zero. Results are draft until finalized.</span>
          <span class="status-pill draft">In Progress</span>
        `;
      }
    }

    const metricsRow = document.getElementById("reportMetricsRow");
    if (metricsRow) {
      const summary = report.summary || {};
      metricsRow.innerHTML = `
        <div class="report-metric-card">
          <div class="report-metric-icon icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div class="report-metric-value">${summary.total_students || 0}</div>
            <div class="report-metric-title">Total Students</div>
          </div>
        </div>
        <div class="report-metric-card">
          <div class="report-metric-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="8" x2="16" y1="10" y2="10"/></svg>
          </div>
          <div>
            <div class="report-metric-value">${summary.total_assignments || 0}</div>
            <div class="report-metric-title">Total Assignments</div>
          </div>
        </div>
        <div class="report-metric-card">
          <div class="report-metric-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <div class="report-metric-value">${escapeHtml(summary.average_score_pct || "0%")}</div>
            <div class="report-metric-title">Average Score</div>
          </div>
        </div>
        <div class="report-metric-card">
          <div class="report-metric-icon icon-orange">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div class="report-metric-value">${escapeHtml(summary.completion_rate_pct || "0%")}</div>
            <div class="report-metric-title">Completion Rate</div>
          </div>
        </div>
      `;
    }

    const chartContainer = document.getElementById("reportSubjectChartContainer");
    if (chartContainer) {
      const subjects = report.subjects || [];
      if (subjects.length === 0) {
        chartContainer.innerHTML = `<div class="dash-empty-state" style="padding: 2rem; text-align: center;"><p>No subject performance data available.</p></div>`;
      } else {
        const barGroupsHtml = subjects.map((sub) => {
          const avgPct = Math.min(100, Math.max(0, parseFloat(sub.class_average_pct) || 0));
          const highPct = Math.min(100, Math.max(0, parseFloat(sub.highest_score_pct) || 0));
          const avgHeight = Math.round((avgPct / 100) * 150);
          const highHeight = Math.round((highPct / 100) * 150);

          return `
            <div class="bar-group-col">
              <div class="bars-pair">
                <div class="chart-bar bar-avg" style="height: ${avgHeight}px;" title="Class Average: ${escapeHtml(sub.class_average_pct)}">
                  <span class="bar-value-tooltip">${escapeHtml(sub.class_average_pct)}</span>
                </div>
                <div class="chart-bar bar-high" style="height: ${highHeight}px;" title="Highest Score: ${escapeHtml(sub.highest_score_pct)}">
                  <span class="bar-value-tooltip">${escapeHtml(sub.highest_score_pct)}</span>
                </div>
              </div>
              <span class="bar-subject-label">${escapeHtml(sub.subject_name)}</span>
            </div>
          `;
        }).join("");

        chartContainer.innerHTML = barGroupsHtml;
      }
    }

    const topTbody = document.getElementById("reportTopStudentsTbody");
    if (topTbody) {
      const topStudents = report.top_students || [];
      if (topStudents.length === 0) {
        topTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">No student performance recorded yet.</td></tr>`;
      } else {
        const rowsHtml = topStudents.map((st) => {
          const statusClass = st.status === "Excellent" ? "open" : (st.status === "Good" ? "info" : "warning");
          return `
            <tr>
              <td style="color: #64748b; font-weight: 500;">${st.rank}</td>
              <td style="font-weight: 600; color: #1e293b;">${escapeHtml(st.student_name)}</td>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(st.overall_pct)}</td>
              <td style="color: #475569;">${st.subjects_count}</td>
              <td><span class="status-pill ${statusClass}">${escapeHtml(st.status)}</span></td>
            </tr>
          `;
        }).join("");
        topTbody.innerHTML = rowsHtml;
      }
    }

    const btnCsv = document.getElementById("btnExportSemesterCsv");
    if (btnCsv) {
      btnCsv.onclick = () => exportSemesterCsv(semId);
    }
    const btnPdf = document.getElementById("btnExportSemesterPdf");
    if (btnPdf) {
      btnPdf.onclick = () => window.print();
    }
    const btnFinalize = document.getElementById("btnFinalizeSemesterReport");
    if (btnFinalize) {
      if (report.is_finalized) {
        btnFinalize.disabled = true;
        btnFinalize.textContent = "Finalized";
      } else {
        btnFinalize.disabled = false;
        btnFinalize.textContent = "Finalize Results";
        btnFinalize.onclick = () => handleFinalizeSemester(semId);
      }
    }
  } catch (err) {
    console.error("Report render error:", err);
  }
}

async function exportSemesterCsv(semesterId) {
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}/report/export-csv`, {
      method: "GET",
      credentials: "same-origin",
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `semester_${semesterId}_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Sanitized CSV report downloaded successfully.", "success");
    } else {
      showToast("Failed to export report CSV.", "error");
    }
  } catch (err) {
    showToast("Error downloading report CSV.", "error");
  }
}

function openSemesterReportView(semesterId) {
  state.activeSemesterId = semesterId;
  navigateToView("reports");
}

function exportSubjectStudentsCsv(subjectId, subjectName) {
  showToast(`Exporting student roster for ${subjectName}...`, "info");
  const table = document.querySelector("#subjectStudentsTableWrap table");
  if (!table) return;
  let csv = "Rank,Student Name,Submissions,Average Score,Status\n";
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row, i) => {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 5) {
      const name = cells[1].querySelector(".student-table-user-cell div div")?.textContent?.trim() || "";
      const subs = cells[2].textContent.trim();
      const avg = cells[3].textContent.trim();
      const status = cells[4].textContent.trim();
      const safeName = /^[=+\-@\t\r]/.test(name) ? "'" + name : name;
      csv += `${i + 1},"${safeName.replace(/"/g, '""')}","${subs}","${avg}","${status}"\n`;
    }
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${subjectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_students.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Subject student roster exported successfully.", "success");
}
