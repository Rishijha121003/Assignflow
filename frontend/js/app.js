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
  notifications: `${API_BASE}/api/notifications`,
  analytics: Object.assign(
    (classId) => `${API_BASE}/api/analytics/classes/${classId}`,
    {
      toString: () => `${API_BASE}/api/analytics`,
      overview: (classId, subject) => `${API_BASE}/api/analytics/classes/${classId}/overview${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
      rankings: (classId, subject) => `${API_BASE}/api/analytics/classes/${classId}/subjects/${encodeURIComponent(subject)}/rankings`,
      leaderboard: (classId, subject) => `${API_BASE}/api/analytics/classes/${classId}/subjects/${encodeURIComponent(subject)}/leaderboard`,
      alerts: (classId, subject) => `${API_BASE}/api/analytics/classes/${classId}/alerts${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
      feedback: (classId, subject) => `${API_BASE}/api/analytics/student/feedback?class_id=${classId}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`,
      summaryCsv: (classId) => `${API_BASE}/api/analytics/classes/${classId}/reports/summary.csv`,
      detailedCsv: (classId, subject) => `${API_BASE}/api/analytics/classes/${classId}/reports/detailed.csv${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
    }
  ),
  workflow: {
    extensions: (id) => `${API_BASE}/api/assignments/${id}/extensions`,
    allowResubmission: (id) => `${API_BASE}/api/submissions/${id}/allow-resubmission`,
    gradeCorrections: (id) => `${API_BASE}/api/submissions/${id}/corrections`,
    correctGrade: (id) => `${API_BASE}/api/submissions/${id}/correct-grade`,
    submissionHistory: (id) => `${API_BASE}/api/submissions/${id}/history`,
    requestReevaluation: (id) => `${API_BASE}/api/submissions/${id}/request-reevaluation`,
    reevaluations: (id) => `${API_BASE}/api/assignments/${id}/reevaluations`,
    reevaluationDecision: (id) => `${API_BASE}/api/reevaluations/${id}/decision`,
    finalize: (classId, subject) => `${API_BASE}/api/classes/${classId}/subjects/${encodeURIComponent(subject)}/finalize`,
    finalized: (classId, subject) => `${API_BASE}/api/classes/${classId}/subjects/${encodeURIComponent(subject)}/finalized`,
  },
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
  authEpoch: 0,
  activeAbortController: null,
  currentAnalyticsClassId: null,
  analyticsOverviewData: null,
  analyticsRankingsData: null,
  analyticsSubmissionsData: null,
  currentGradingAssignment: null,
  currentGradingSubmissions: [],
  currentGradingIndex: 0,
  pendingSingleReleaseSubId: null,
  isGradingSaving: false,
  selectedSubmissionIds: new Set(),
};

let currentAnalyticsClassId = null;
let currentAnalyticsSubject = "";

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
  notificationDropdownWrapper: document.getElementById("notificationDropdownWrapper"),
  notificationBadge: document.getElementById("notificationBadge"),
  notificationMenu: document.getElementById("notificationMenu"),
  notificationList: document.getElementById("notificationList"),
  markAllNotificationsReadBtn: document.getElementById("markAllNotificationsReadBtn"),
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
  navTextCalendar: document.getElementById("navTextCalendar"),
  navAnalytics: document.getElementById("navAnalytics"),
  topNavAnalytics: document.getElementById("topNavAnalytics"),
  topNavTextAnalytics: document.getElementById("topNavTextAnalytics"),
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

  btnModalResubmitWork: document.getElementById("btnModalResubmitWork"),
  btnModalViewHistory: document.getElementById("btnModalViewHistory"),
  viewSubResubmitBanner: document.getElementById("viewSubResubmitBanner"),
  viewSubResubmitTitle: document.getElementById("viewSubResubmitTitle"),
  viewSubResubmitNote: document.getElementById("viewSubResubmitNote"),
  viewSubResubmitDeadline: document.getElementById("viewSubResubmitDeadline"),
  submitWorkResubmitBanner: document.getElementById("submitWorkResubmitBanner"),
  submitWorkResubmitTitle: document.getElementById("submitWorkResubmitTitle"),
  submitWorkResubmitNote: document.getElementById("submitWorkResubmitNote"),
  submitWorkResubmitDeadline: document.getElementById("submitWorkResubmitDeadline"),
  gradeCorrectionModalBackdrop: document.getElementById("gradeCorrectionModalBackdrop"),
  closeCorrectionModalBtn: document.getElementById("closeCorrectionModalBtn"),
  cancelCorrectionBtn: document.getElementById("cancelCorrectionBtn"),
  confirmCorrectionBtn: document.getElementById("confirmCorrectionBtn"),
  correctionPreviousGrade: document.getElementById("correctionPreviousGrade"),
  correctionNewGrade: document.getElementById("correctionNewGrade"),
  correctionReasonInput: document.getElementById("correctionReasonInput"),
  correctionAlert: document.getElementById("correctionAlert"),
  correctionHistoryList: document.getElementById("correctionHistoryList"),
  resubmissionModalBackdrop: document.getElementById("resubmissionModalBackdrop"),
  closeResubmissionModalBtn: document.getElementById("closeResubmissionModalBtn"),
  cancelResubmissionBtn: document.getElementById("cancelResubmissionBtn"),
  confirmResubmissionBtn: document.getElementById("confirmResubmissionBtn"),
  resubmissionDeadlineInput: document.getElementById("resubmissionDeadlineInput"),
  resubmissionNoteInput: document.getElementById("resubmissionNoteInput"),
  resubmissionAlert: document.getElementById("resubmissionAlert"),
  reevaluationModalBackdrop: document.getElementById("reevaluationModalBackdrop"),
  closeReevaluationModalBtn: document.getElementById("closeReevaluationModalBtn"),
  cancelStudentReevalBtn: document.getElementById("cancelStudentReevalBtn"),
  submitReevaluationRequestBtn: document.getElementById("submitReevaluationRequestBtn"),
  submitReevaluationDecisionBtn: document.getElementById("submitReevaluationDecisionBtn"),
  reevaluationStudentSection: document.getElementById("reevaluationStudentSection"),
  reevaluationTeacherSection: document.getElementById("reevaluationTeacherSection"),
  reevaluationTeacherReason: document.getElementById("reevaluationTeacherReason"),
  reevalReasonInput: document.getElementById("reevalReasonInput"),
  reevalDecisionSelect: document.getElementById("reevalDecisionSelect"),
  reevalRevisedGrade: document.getElementById("reevalRevisedGrade"),
  reevalDecisionNotes: document.getElementById("reevalDecisionNotes"),
  reevaluationAlert: document.getElementById("reevaluationAlert"),
  btnModalRequestReeval: document.getElementById("btnModalRequestReeval"),
  btnResultsCardReeval: document.getElementById("btnResultsCardReeval"),
  viewSubReevalActionBox: document.getElementById("viewSubReevalActionBox"),
  submissionHistoryModalBackdrop: document.getElementById("submissionHistoryModalBackdrop"),
  closeSubmissionHistoryModalBtn: document.getElementById("closeSubmissionHistoryModalBtn"),
  closeSubmissionHistoryBottomBtn: document.getElementById("closeSubmissionHistoryBottomBtn"),
  closeSubmissionHistoryFooterBtn: document.getElementById("closeSubmissionHistoryFooterBtn"),
  submissionHistoryTimeline: document.getElementById("submissionHistoryTimeline"),
  historyAttemptsList: document.getElementById("historyAttemptsList"),
  historyStudentMeta: document.getElementById("historyStudentMeta"),
  structureModalBackdrop: document.getElementById("structureModalBackdrop"),
  structureClassSelect: document.getElementById("structureClassSelect"),
  structureTreeContainer: document.getElementById("structureTreeContainer"),
  closeStructureModalBtn: document.getElementById("closeStructureModalBtn"),
  closeStructureFooterBtn: document.getElementById("closeStructureFooterBtn"),
  finalizeModalBackdrop: document.getElementById("finalizeModalBackdrop"),
  finalizeConfirmCheckbox: document.getElementById("finalizeConfirmCheckbox"),
  finalizeAuditNote: document.getElementById("finalizeAuditNote"),
  finalizeAlert: document.getElementById("finalizeAlert"),
  finalizeUnitsChecklist: document.getElementById("finalizeUnitsChecklist"),
  finalizeNotesInput: document.getElementById("finalizeNotesInput"),
  confirmFinalizeBtn: document.getElementById("confirmFinalizeBtn"),
  cancelFinalizeBtn: document.getElementById("cancelFinalizeBtn"),
  closeFinalizeModalBtn: document.getElementById("closeFinalizeModalBtn"),
  analyticsClassSelect: document.getElementById("analyticsClassSelect"),
  analyticsSubjectSelect: document.getElementById("analyticsSubjectSelect"),
  btnFinalizeResults: document.getElementById("btnFinalizeResults"),
  btnExportSummaryCsv: document.getElementById("btnExportSummaryCsv"),
  btnExportDetailedCsv: document.getElementById("btnExportDetailedCsv"),
  btnToggleLeaderboard: document.getElementById("btnToggleLeaderboard"),
  btnCloseLeaderboard: document.getElementById("btnCloseLeaderboard"),
  analyticsKpiRow: document.getElementById("analyticsKpiRow"),
  analyticsRankingsCard: document.getElementById("analyticsRankingsCard"),
  analyticsRankingsTitle: document.getElementById("analyticsRankingsTitle"),
  analyticsRankingsSubtitle: document.getElementById("analyticsRankingsSubtitle"),
  analyticsUnitComparisonsBody: document.getElementById("analyticsUnitComparisonsBody"),
  analyticsRightCard: document.getElementById("analyticsRightCard"),
  analyticsRightCardTitle: document.getElementById("analyticsRightCardTitle"),
  analyticsRightCardSubtitle: document.getElementById("analyticsRightCardSubtitle"),
  analyticsRightCardBody: document.getElementById("analyticsRightCardBody"),
  analyticsRankingsHead: document.getElementById("analyticsRankingsHead"),
  analyticsRankingsBody: document.getElementById("analyticsRankingsBody"),
  analyticsAlertsContainer: document.getElementById("analyticsAlertsContainer"),
  analyticsFinalizedBadge: document.getElementById("analyticsFinalizedBadge"),
  analyticsStudentFeedbackCard: document.getElementById("analyticsStudentFeedbackCard"),
  analyticsStudentFeedbackBody: document.getElementById("analyticsStudentFeedbackBody"),
  analyticsLeaderboardCard: document.getElementById("analyticsLeaderboardCard"),
  analyticsLeaderboardTable: document.getElementById("analyticsLeaderboardTable"),
  analyticsLeaderboardBody: document.getElementById("analyticsLeaderboardBody"),
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
  submissionsQueueTabs: document.getElementById("submissionsQueueTabs"),
  countQueueAll: document.getElementById("countQueueAll"),
  countQueueNeedsGrading: document.getElementById("countQueueNeedsGrading"),
  countQueueDraftGrades: document.getElementById("countQueueDraftGrades"),
  countQueueReeval: document.getElementById("countQueueReeval"),
  countQueueReleased: document.getElementById("countQueueReleased"),

  // Calendar Page Elements
  calendarViewAssignmentsBtn: document.getElementById("calendarViewAssignmentsBtn"),
  calendarDeadlinesList: document.getElementById("calendarDeadlinesList"),
  calendarMiniMonthContainer: document.getElementById("calendarMiniMonthContainer"),
  calendarCurrentMonthLabel: document.getElementById("calendarCurrentMonthLabel"),
  calendarPrevMonthBtn: document.getElementById("calendarPrevMonthBtn"),
  calendarNextMonthBtn: document.getElementById("calendarNextMonthBtn"),
  calendarMonthYearDisplay: document.getElementById("calendarMonthYearDisplay"),
  calendarTodayBtn: document.getElementById("calendarTodayBtn"),
  calendarAllDatesBtn: document.getElementById("calendarAllDatesBtn"),
  calendarGridTitle: document.getElementById("calendarGridTitle"),
  calendarAgendaTitle: document.getElementById("calendarAgendaTitle"),
  calendarAgendaSubtitle: document.getElementById("calendarAgendaSubtitle"),

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
  prefInAppEnabled: document.getElementById("prefInAppEnabled"),
  prefEmailEnabled: document.getElementById("prefEmailEnabled"),
  prefEmailGradeReleased: document.getElementById("prefEmailGradeReleased"),
  prefEmailDeadline: document.getElementById("prefEmailDeadline"),
  prefEmailReevaluation: document.getElementById("prefEmailReevaluation"),
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

  // Classes & Curriculum Management
  openClassesModalBtn: document.getElementById("openClassesModalBtn"),
  openStructureModalBtn: document.getElementById("openStructureModalBtn"),
  structureLoadingSpinner: document.getElementById("structureLoadingSpinner"),
  structureEmptyState: document.getElementById("structureEmptyState"),
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
  gradingReevaluationBanner: document.getElementById("gradingReevaluationBanner"),
  gradingReevaluationReasonText: document.getElementById("gradingReevaluationReasonText"),
  gradingResolveReevalBtn: document.getElementById("gradingResolveReevalBtn"),
  gradingReviewReevalBtn: document.getElementById("gradingReviewReevalBtn"),

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
  resubmissionDeadlineInput: document.getElementById("resubmissionDeadlineInput"),

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
      viewSubjectDetail(parseInt(subjectMatch[1], 10), "assignments", false);
      return;
    }
    const route = rawHash || "dashboard";
    navigateToView(route, false);
  });

  // Nav item click interaction (Top navigation bar, drawer, footer, settings, and modal links)
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-nav");
      if (target) {
        if (typeof closeAuthModal === "function") {
          closeAuthModal();
        }
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
  if (elements.notificationBtn) {
    elements.notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (elements.notificationMenu) {
        const isShown = elements.notificationMenu.style.display === "block";
        elements.notificationMenu.style.display = isShown ? "none" : "block";
        if (!isShown) {
          fetchNotifications();
        }
      }
    });
  }

  // Profile dropdown toggle
  elements.profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileMenu();
  });

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (elements.profileDropdownWrapper && !elements.profileDropdownWrapper.contains(e.target)) {
      closeProfileMenu();
    }
    if (elements.notificationDropdownWrapper && !elements.notificationDropdownWrapper.contains(e.target)) {
      if (elements.notificationMenu) elements.notificationMenu.style.display = "none";
    }
  });

  if (elements.markAllNotificationsReadBtn) {
    elements.markAllNotificationsReadBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const res = await fetch(`${API_ENDPOINTS.notifications}/read-all`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          await fetchNotifications();
        }
      } catch (err) {
        console.error("Failed to mark all notifications as read:", err);
      }
    });
  }

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
      navigateToView("classes", true);
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

  // Curriculum Units Modal Listeners
  if (elements.openStructureModalBtn) {
    elements.openStructureModalBtn.addEventListener("click", () => openStructureModal());
  }
  if (elements.closeStructureModalBtn) {
    elements.closeStructureModalBtn.addEventListener("click", closeStructureModal);
  }
  if (elements.closeStructureFooterBtn) {
    elements.closeStructureFooterBtn.addEventListener("click", closeStructureModal);
  }
  if (elements.structureModalBackdrop) {
    elements.structureModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.structureModalBackdrop) {
        closeStructureModal();
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
    elements.gradingSubmissionHistoryBtn.addEventListener("click", openTeacherSpeedGraderHistoryModal);
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

  // Grade Correction Modal Listeners
  if (elements.closeCorrectionModalBtn) {
    elements.closeCorrectionModalBtn.addEventListener("click", closeGradeCorrectionModal);
  }
  if (elements.cancelCorrectionBtn) {
    elements.cancelCorrectionBtn.addEventListener("click", closeGradeCorrectionModal);
  }
  if (elements.confirmCorrectionBtn) {
    elements.confirmCorrectionBtn.addEventListener("click", handleConfirmGradeCorrection);
  }
  if (elements.gradeCorrectionModalBackdrop) {
    elements.gradeCorrectionModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.gradeCorrectionModalBackdrop) closeGradeCorrectionModal();
    });
  }

  // Resubmission Modal Listeners
  if (elements.closeResubmissionModalBtn) {
    elements.closeResubmissionModalBtn.addEventListener("click", closeResubmissionModal);
  }
  if (elements.cancelResubmissionBtn) {
    elements.cancelResubmissionBtn.addEventListener("click", closeResubmissionModal);
  }
  if (elements.confirmResubmissionBtn) {
    elements.confirmResubmissionBtn.addEventListener("click", handleConfirmResubmission);
  }
  if (elements.resubmissionModalBackdrop) {
    elements.resubmissionModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.resubmissionModalBackdrop) closeResubmissionModal();
    });
  }

  // Re-evaluation Modal Listeners
  if (elements.closeReevaluationModalBtn) {
    elements.closeReevaluationModalBtn.addEventListener("click", closeReevaluationModal);
  }
  if (elements.cancelStudentReevalBtn) {
    elements.cancelStudentReevalBtn.addEventListener("click", closeReevaluationModal);
  }
  if (elements.submitReevaluationRequestBtn) {
    elements.submitReevaluationRequestBtn.addEventListener("click", handleSubmitReevaluationRequest);
  }
  if (elements.submitReevaluationDecisionBtn) {
    elements.submitReevaluationDecisionBtn.addEventListener("click", handleSubmitReevaluationDecision);
  }
  if (elements.reevaluationModalBackdrop) {
    elements.reevaluationModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.reevaluationModalBackdrop) closeReevaluationModal();
    });
  }

  // Submission History Modal Listeners
  if (elements.closeSubmissionHistoryModalBtn) {
    elements.closeSubmissionHistoryModalBtn.addEventListener("click", closeSubmissionHistoryModal);
  }
  if (elements.closeSubmissionHistoryBottomBtn) {
    elements.closeSubmissionHistoryBottomBtn.addEventListener("click", closeSubmissionHistoryModal);
  }
  if (elements.closeSubmissionHistoryFooterBtn) {
    elements.closeSubmissionHistoryFooterBtn.addEventListener("click", closeSubmissionHistoryModal);
  }
  if (elements.submissionHistoryModalBackdrop) {
    elements.submissionHistoryModalBackdrop.addEventListener("click", (e) => {
      if (e.target === elements.submissionHistoryModalBackdrop) closeSubmissionHistoryModal();
    });
  }

  // Resubmit, View History, and Request Re-evaluation Button Listeners in View Submission Modal
  if (elements.btnModalResubmitWork) {
    elements.btnModalResubmitWork.addEventListener("click", () => {
      if (state.currentViewingSubmission && state.currentViewingAssignment) {
        const sub = state.currentViewingSubmission;
        const asgn = state.currentViewingAssignment;
        closeViewSubmissionModal();
        openSubmitWorkModal(asgn, sub);
      }
    });
  }
  if (elements.btnModalViewHistory) {
    elements.btnModalViewHistory.addEventListener("click", () => {
      if (state.currentViewingSubmission) {
        openSubmissionHistoryModal(state.currentViewingSubmission);
      }
    });
  }
  if (elements.btnModalRequestReeval) {
    elements.btnModalRequestReeval.addEventListener("click", () => {
      if (state.currentViewingSubmission) {
        openStudentReevaluationModal(state.currentViewingSubmission);
      }
    });
  }
  if (elements.btnResultsCardReeval) {
    elements.btnResultsCardReeval.addEventListener("click", () => {
      if (state.currentViewingSubmission) {
        openStudentReevaluationModal(state.currentViewingSubmission);
      }
    });
  }

  // Escape and Alt+Arrow handling
  window.addEventListener("keydown", (e) => {
    if (elements.gradeCorrectionModalBackdrop && elements.gradeCorrectionModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        closeGradeCorrectionModal();
      }
      return;
    }
    if (elements.resubmissionModalBackdrop && elements.resubmissionModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        closeResubmissionModal();
      }
      return;
    }
    if (elements.reevaluationModalBackdrop && elements.reevaluationModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        closeReevaluationModal();
      }
      return;
    }
    if (elements.submissionHistoryModalBackdrop && elements.submissionHistoryModalBackdrop.style.display === "flex") {
      if (e.key === "Escape") {
        closeSubmissionHistoryModal();
      }
      return;
    }
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      if (elements.gradeCorrectionModalBackdrop && elements.gradeCorrectionModalBackdrop.style.display === "flex") {
        e.preventDefault();
        return;
      }
    }
  });

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

  // Analytics Page Controls
  if (elements.analyticsClassSelect) {
    elements.analyticsClassSelect.addEventListener("change", handleAnalyticsClassChange);
  }
  if (elements.analyticsSubjectSelect) {
    elements.analyticsSubjectSelect.addEventListener("change", handleAnalyticsSubjectChange);
  }
  if (elements.btnExportSummaryCsv) {
    elements.btnExportSummaryCsv.addEventListener("click", handleDownloadSummaryCsv);
  }
  if (elements.btnExportDetailedCsv) {
    elements.btnExportDetailedCsv.addEventListener("click", handleDownloadDetailedCsv);
  }
  if (elements.btnToggleLeaderboard) {
    elements.btnToggleLeaderboard.addEventListener("click", toggleLeaderboard);
  }
  if (elements.btnCloseLeaderboard) {
    elements.btnCloseLeaderboard.addEventListener("click", () => {
      if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";
    });
  }
  if (elements.btnFinalizeResults) {
    elements.btnFinalizeResults.addEventListener("click", openFinalizeModal);
  }
  if (elements.confirmFinalizeBtn) {
    elements.confirmFinalizeBtn.addEventListener("click", handleConfirmFinalize);
  }
  if (elements.cancelFinalizeBtn) {
    elements.cancelFinalizeBtn.addEventListener("click", () => {
      if (elements.finalizeModalBackdrop) elements.finalizeModalBackdrop.style.display = "none";
    });
  }
  if (elements.closeFinalizeModalBtn) {
    elements.closeFinalizeModalBtn.addEventListener("click", () => {
      if (elements.finalizeModalBackdrop) elements.finalizeModalBackdrop.style.display = "none";
    });
  }

  // Keyboard Shortcuts (ESC to close modals/drawers, Ctrl+K to search)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (elements.globalSearchInput) {
        e.preventDefault();
        elements.globalSearchInput.focus();
        elements.globalSearchInput.select();
      }
    }
    if (e.key === "Escape") {
      closeDrawer();
      closeDeleteModal();
      closeSidebar();
      closeProfileMenu();
      closeClassesModal();
      closeStructureModal();
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
// WORKFLOW & NOTIFICATION HELPER FUNCTIONS
// ==========================================================================

async function fetchNotifications() {
  if (!state.currentUser) return;
  const epoch = state.authEpoch;
  const user = state.currentUser;
  try {
    const res = await fetch(API_ENDPOINTS.notifications, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch || state.currentUser?.id !== user?.id) return;
    if (!res.ok) return;
    const notifications = await res.json();
    if (epoch !== state.authEpoch || state.currentUser?.id !== user?.id) return;
    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (elements.notificationBadge) {
      if (unreadCount > 0) {
        elements.notificationBadge.textContent = unreadCount > 9 ? "9+" : unreadCount;
        elements.notificationBadge.style.display = "block";
      } else {
        elements.notificationBadge.style.display = "none";
      }
    }

    if (elements.notificationList) {
      if (!notifications.length) {
        elements.notificationList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications</div>`;
      } else {
        elements.notificationList.innerHTML = notifications.slice(0, 15).map(n => `
          <div class="notification-item" data-id="${n.id}" data-link="${escapeHtml(n.link_url || '')}" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer; background: ${n.is_read ? 'transparent' : 'var(--surface-highlight)'}; display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600; font-size: 0.825rem; color: var(--text-main);">${escapeHtml(n.title)}</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">${new Date(n.created_at).toLocaleDateString([], {month:'short', day:'numeric'})}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(n.message)}</div>
          </div>
        `).join("");

        elements.notificationList.querySelectorAll(".notification-item").forEach(item => {
          item.addEventListener("click", async () => {
            const notifId = item.getAttribute("data-id");
            const linkUrl = item.getAttribute("data-link");
            try {
              await fetch(`${API_ENDPOINTS.notifications}/${notifId}/read`, {
                method: "PUT",
                credentials: "same-origin",
              });
              await fetchNotifications();
            } catch (e) {}
            if (linkUrl) {
              window.location.hash = linkUrl.replace(/^\//, "");
            }
            if (elements.notificationMenu) elements.notificationMenu.style.display = "none";
          });
        });
      }
    }
  } catch (err) {
    console.error("Notifications error:", err);
  }
}

// Extensions
let currentExtensionAssignmentId = null;

async function openExtensionsModal(asgnId) {
  currentExtensionAssignmentId = asgnId;
  const asgn = state.assignments.find(a => a.id === asgnId);
  if (!asgn) return;

  if (elements.extensionsAlert) elements.extensionsAlert.style.display = "none";
  if (elements.extensionsModalSubtitle) {
    elements.extensionsModalSubtitle.textContent = `Extensions for: ${asgn.title}`;
  }

  if (elements.extensionStudentSelect) {
    elements.extensionStudentSelect.innerHTML = `<option value="">Select student...</option>`;
    if (asgn.class_id) {
      try {
        const res = await fetch(`${API_ENDPOINTS.classes}/${asgn.class_id}/students`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        });
        if (res.ok) {
          const students = await res.json();
          elements.extensionStudentSelect.innerHTML += students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name || s.email)}</option>`).join("");
        }
      } catch (e) {}
    }
  }

  if (elements.extensionDeadlineInput) {
    const d = new Date(asgn.due_date || Date.now());
    d.setDate(d.getDate() + 3);
    elements.extensionDeadlineInput.value = formatInputDate(d);
  }

  await loadExistingExtensions(asgnId);
  if (elements.extensionsModalBackdrop) elements.extensionsModalBackdrop.style.display = "flex";
}

async function loadExistingExtensions(asgnId) {
  if (!elements.extensionsListContainer) return;
  try {
    const res = await fetch(API_ENDPOINTS.workflow.extensions(asgnId), {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (res.ok) {
      const exts = await res.json();
      if (!exts.length) {
        elements.extensionsListContainer.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No active extensions for this assignment.</p>`;
      } else {
        elements.extensionsListContainer.innerHTML = exts.map(e => `
          <div style="padding: 0.6rem 0.8rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: #f8fafc; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 600;">Student #${e.student_id}</span>
              <div style="font-size: 0.75rem; color: #64748b;">Reason: ${escapeHtml(e.reason || "None")}</div>
            </div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #2563eb;">
              Due: ${new Date(e.extended_due_date).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
            </div>
          </div>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Extensions load error:", err);
  }
}

async function handleGrantExtension(e) {
  e.preventDefault();
  if (!currentExtensionAssignmentId) return;

  const studentId = parseInt(elements.extensionStudentSelect.value, 10);
  const deadlineVal = elements.extensionDeadlineInput.value;
  const reasonVal = elements.extensionReasonInput.value.trim();

  if (!studentId || !deadlineVal || !reasonVal) {
    showToast("Please fill in all extension fields.", "warning");
    return;
  }

  try {
    const res = await fetch(API_ENDPOINTS.workflow.extensions(currentExtensionAssignmentId), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        extended_due_date: new Date(deadlineVal).toISOString(),
        reason: reasonVal
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Failed to grant extension.", "error");
      return;
    }
    showToast("Extension granted successfully.", "success");
    elements.extensionReasonInput.value = "";
    await loadExistingExtensions(currentExtensionAssignmentId);
  } catch (e) {
    showToast("Network error", "error");
  }
}

// Resubmissions
let currentWorkflowSubmission = null;

function openResubmissionModal(sub) {
  currentWorkflowSubmission = sub;
  if (elements.resubmissionAlert) elements.resubmissionAlert.style.display = "none";
  if (elements.resubmissionDeadlineInput) elements.resubmissionDeadlineInput.value = "";
  if (elements.resubmissionNotesInput) elements.resubmissionNotesInput.value = "";
  if (elements.resubmissionModalBackdrop) elements.resubmissionModalBackdrop.style.display = "flex";
}

let isAllowingResubmission = false;

async function handleConfirmResubmission() {
  if (!currentWorkflowSubmission || isAllowingResubmission) return;
  const deadlineVal = elements.resubmissionDeadlineInput ? elements.resubmissionDeadlineInput.value : null;
  const isoDeadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  const notes = elements.resubmissionNotesInput ? elements.resubmissionNotesInput.value.trim() : null;

  isAllowingResubmission = true;
  if (elements.confirmResubmissionBtn) {
    elements.confirmResubmissionBtn.disabled = true;
    elements.confirmResubmissionBtn.textContent = "Authorizing...";
  }

  try {
    const res = await fetch(API_ENDPOINTS.workflow.allowResubmission(currentWorkflowSubmission.id), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        resubmission_deadline: isoDeadline,
        resubmission_note: notes
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Failed to allow resubmission", "error");
      return;
    }
    showToast("Resubmission permitted for student.", "success");
    closeResubmissionModal();
    if (state.currentGradingAssignment) {
      await fetchTeacherSubmissions(state.currentGradingAssignment);
      if (elements.gradingWorkspaceModalBackdrop && elements.gradingWorkspaceModalBackdrop.style.display === "flex") {
        openGradingWorkspace(state.currentGradingIndex);
      }
    }
  } catch (e) {
    showToast("Network error", "error");
  } finally {
    isAllowingResubmission = false;
    if (elements.confirmResubmissionBtn) {
      elements.confirmResubmissionBtn.disabled = false;
      elements.confirmResubmissionBtn.textContent = "Confirm Authorization";
    }
  }
}

function closeGradeCorrectionModal() {
  if (elements.gradeCorrectionModalBackdrop) {
    elements.gradeCorrectionModalBackdrop.style.display = "none";
  }
  if (elements.correctionAlert) {
    elements.correctionAlert.style.display = "none";
    elements.correctionAlert.textContent = "";
  }
  if (elements.gradingCorrectGradeBtn) {
    elements.gradingCorrectGradeBtn.focus();
  }
}

function closeResubmissionModal() {
  if (elements.resubmissionModalBackdrop) {
    elements.resubmissionModalBackdrop.style.display = "none";
  }
  if (elements.resubmissionAlert) {
    elements.resubmissionAlert.style.display = "none";
    elements.resubmissionAlert.textContent = "";
  }
}

function closeReevaluationModal() {
  if (elements.reevaluationModalBackdrop) {
    elements.reevaluationModalBackdrop.style.display = "none";
  }
  if (elements.reevaluationAlert) {
    elements.reevaluationAlert.style.display = "none";
    elements.reevaluationAlert.textContent = "";
  }
}

function closeSubmissionHistoryModal() {
  if (elements.submissionHistoryModalBackdrop) {
    elements.submissionHistoryModalBackdrop.style.display = "none";
  }
}

// Grade Corrections (Audit Trail)
async function openGradeCorrectionModal(sub) {
  currentWorkflowSubmission = sub;
  if (elements.correctionAlert) {
    elements.correctionAlert.style.display = "none";
    elements.correctionAlert.textContent = "";
  }

  // Resolve current active grade without inventing or defaulting to 0:
  // 1. Saved grade on sub object (number or valid numeric string)
  // 2. Active grade currently displayed in grading panel input (elements.gradingMarksInput)
  // 3. Saved grade in active roster item if sub was shallow
  let currentGrade = null;
  if (sub && sub.grade !== null && sub.grade !== undefined && sub.grade !== "" && !isNaN(Number(sub.grade))) {
    currentGrade = Number(sub.grade);
  } else if (elements.gradingMarksInput && elements.gradingMarksInput.value.trim() !== "") {
    const parsed = parseFloat(elements.gradingMarksInput.value.trim());
    if (!isNaN(parsed)) {
      currentGrade = parsed;
    }
  } else if (state.currentGradingSubmissions && sub && sub.id) {
    const matched = state.currentGradingSubmissions.find((s) => s.id === sub.id);
    if (matched && matched.grade !== null && matched.grade !== undefined && matched.grade !== "" && !isNaN(Number(matched.grade))) {
      currentGrade = Number(matched.grade);
    }
  }

  if (elements.correctionPreviousGrade) {
    elements.correctionPreviousGrade.value = currentGrade !== null ? currentGrade : "";
  }
  if (elements.correctionNewGrade) {
    elements.correctionNewGrade.value = currentGrade !== null ? currentGrade : "";
  }
  if (elements.correctionReasonInput) {
    elements.correctionReasonInput.value = "";
  }

  if (elements.correctionHistoryList) {
    try {
      const res = await fetch(API_ENDPOINTS.workflow.gradeCorrections(sub.id), {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (res.ok) {
        const list = await res.json();
        if (!list.length) {
          elements.correctionHistoryList.innerHTML = `<p style="color: #64748b; margin: 0;">No prior corrections recorded.</p>`;
        } else {
          elements.correctionHistoryList.innerHTML = list.map(c => `
            <div style="padding: 0.35rem 0; border-bottom: 1px solid var(--border-color);">
              <span style="font-weight: 600;">${c.previous_grade !== null && c.previous_grade !== undefined ? c.previous_grade : "—"} ➔ ${c.new_grade}</span>
              <span style="color: #64748b; font-size: 0.75rem; margin-left: 0.5rem;">(${escapeHtml(c.reason)})</span>
            </div>
          `).join("");
        }
      }
    } catch (e) {}
  }

  if (elements.gradeCorrectionModalBackdrop) {
    elements.gradeCorrectionModalBackdrop.style.display = "flex";
  }

  // Set focus to the corrected grade input
  if (elements.correctionNewGrade) {
    setTimeout(() => {
      elements.correctionNewGrade.focus();
      elements.correctionNewGrade.select();
    }, 50);
  }
}

async function handleConfirmGradeCorrection() {
  if (!currentWorkflowSubmission) return;
  const newGradeVal = parseFloat(elements.correctionNewGrade.value);
  const reasonVal = elements.correctionReasonInput.value.trim();

  if (isNaN(newGradeVal)) {
    showToast("Please enter a valid numeric grade.", "warning");
    return;
  }
  if (!reasonVal) {
    showToast("Correction reason is required for audit trail.", "warning");
    return;
  }

  try {
    const res = await fetch(API_ENDPOINTS.workflow.correctGrade(currentWorkflowSubmission.id), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        new_grade: newGradeVal,
        reason: reasonVal
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Failed to save grade correction.", "error");
      return;
    }
    showToast("Grade corrected and logged in audit trail.", "success");
    closeGradeCorrectionModal();

    // Update in-memory state
    currentWorkflowSubmission.grade = newGradeVal;
    if (currentWorkflowSubmission.status === "submitted") {
      currentWorkflowSubmission.status = "graded";
    }
    if (state.currentGradingSubmissions && state.currentGradingSubmissions[state.currentGradingIndex]) {
      state.currentGradingSubmissions[state.currentGradingIndex].grade = newGradeVal;
      if (state.currentGradingSubmissions[state.currentGradingIndex].status === "submitted") {
        state.currentGradingSubmissions[state.currentGradingIndex].status = "graded";
      }
    }
    if (elements.gradingMarksInput) {
      elements.gradingMarksInput.value = newGradeVal;
    }

    if (state.currentGradingAssignment) {
      await fetchTeacherSubmissions(state.currentGradingAssignment);
      if (elements.gradingWorkspaceModalBackdrop && elements.gradingWorkspaceModalBackdrop.style.display === "flex") {
        openGradingWorkspace(state.currentGradingIndex);
      }
    }
  } catch (e) {
    showToast("Network error", "error");
  }
}

// Submission History Modal
async function openSubmissionHistoryModal(sub) {
  if (!sub) {
    if (state.currentGradingIndex >= 0 && state.currentGradingSubmissions && state.currentGradingIndex < state.currentGradingSubmissions.length) {
      sub = state.currentGradingSubmissions[state.currentGradingIndex];
    } else if (state.currentViewingSubmission) {
      sub = state.currentViewingSubmission;
    }
  }
  if (!sub) return;

  const container = elements.historyAttemptsList || document.getElementById("historyAttemptsList");
  if (!container) return;

  const assignment = state.currentGradingAssignment || state.currentViewingAssignment;
  const asgnTitle = (assignment && assignment.title) || sub.assignment_title || "Assignment";
  const stLabel = sub.student_name ? `${sub.student_name} • ` : "";
  if (elements.historyStudentMeta) {
    elements.historyStudentMeta.textContent = `${stLabel}${asgnTitle}`;
  }

  container.innerHTML = `<div style="padding: 1.5rem; color: #64748b; text-align: center;"><div class="spinner" style="margin: 0 auto 0.75rem;"></div>Loading attempt history...</div>`;
  if (elements.submissionHistoryModalBackdrop) elements.submissionHistoryModalBackdrop.style.display = "flex";

  try {
    const res = await fetch(API_ENDPOINTS.workflow.submissionHistory(sub.id), {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Failed to load attempt history (${res.status}).</p>`;
      return;
    }

    const history = await res.json();
    const formattedDate = formatDisplayDateTime(sub.submitted_at);
    const maxMarks = (assignment && assignment.max_marks) || sub.max_marks || 100;
    const gradeStr = (sub.grade !== null && sub.grade !== undefined)
      ? `${sub.grade} / ${maxMarks}`
      : "Pending Review";
    const assignmentId = (assignment && assignment.id) || sub.assignment_id;
    const downloadUrl = sub.download_url || `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/download`;

    let html = `
      <div class="history-attempt-card" style="border: 1.5px solid var(--primary); background: rgba(40, 87, 71, 0.05); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
          <div>
            <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">Attempt #${sub.attempt_number || 1} (Current Active Submission)</div>
            <div style="font-size: 0.775rem; color: #64748b; margin-top: 0.2rem;">Submitted: ${formattedDate}</div>
            <div style="font-size: 0.85rem; margin-top: 0.35rem;"><strong>File:</strong> ${escapeHtml(sub.file_name || "submission")} (${formatBytes(sub.file_size || 0)})</div>
            <div style="font-size: 0.85rem; margin-top: 0.2rem; color: var(--text-main);"><strong>Grade:</strong> ${gradeStr}</div>
            ${sub.feedback ? `<div style="font-size: 0.8rem; color: #475569; margin-top: 0.25rem; font-style: italic;">"${escapeHtml(sub.feedback)}"</div>` : ""}
          </div>
          <a class="btn btn-secondary btn-sm" href="${downloadUrl}" download="${escapeHtml(sub.file_name || "submission")}" target="_blank" rel="noopener">
            Download
          </a>
        </div>
      </div>
    `;

    if (history && history.length > 0) {
      html += `<h5 style="margin: 1rem 0 0.5rem; font-size: 0.85rem; color: #64748b; font-weight: 600;">Archived Prior Attempts (${history.length}):</h5>`;
      html += history.map(h => {
        const hDate = formatDisplayDateTime(h.submitted_at);
        const hGrade = (h.grade !== null && h.grade !== undefined) ? `${h.grade} / ${maxMarks}` : "Ungraded at time";
        const hDownload = h.download_url || `${API_BASE}/api/assignments/${assignmentId}/submissions/${sub.id}/download`;
        return `
          <div class="history-attempt-card" style="border: 1px solid var(--border-color); background: #f8fafc; padding: 0.85rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
              <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Attempt #${h.attempt_number} (Archived)</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">Submitted: ${hDate}</div>
                <div style="font-size: 0.825rem; margin-top: 0.3rem;"><strong>File:</strong> ${escapeHtml(h.file_name || "submission")} (${formatBytes(h.file_size || 0)})</div>
                <div style="font-size: 0.825rem; margin-top: 0.15rem; color: #475569;"><strong>Score:</strong> ${hGrade}</div>
                ${h.feedback ? `<div style="font-size: 0.775rem; color: #64748b; margin-top: 0.2rem; font-style: italic;">"${escapeHtml(h.feedback)}"</div>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("");
    } else {
      html += `<p style="font-size: 0.825rem; color: #64748b; font-style: italic; margin-top: 0.5rem;">No prior archived attempts recorded for this submission.</p>`;
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Failed to load attempt history.</p>`;
  }
}

// Re-evaluations
let currentReevaluationRequest = null;

function openStudentReevaluationModal(sub) {
  currentWorkflowSubmission = sub;
  if (elements.reevaluationAlert) elements.reevaluationAlert.style.display = "none";
  if (elements.reevaluationStudentSection) elements.reevaluationStudentSection.style.display = "block";
  if (elements.reevaluationTeacherSection) elements.reevaluationTeacherSection.style.display = "none";
  if (elements.reevalReasonInput) elements.reevalReasonInput.value = "";
  if (elements.reevaluationModalBackdrop) elements.reevaluationModalBackdrop.style.display = "flex";
}

function openTeacherReevaluationModal(req) {
  currentReevaluationRequest = req;
  if (elements.reevaluationAlert) elements.reevaluationAlert.style.display = "none";
  if (elements.reevaluationStudentSection) elements.reevaluationStudentSection.style.display = "none";
  if (elements.reevaluationTeacherSection) elements.reevaluationTeacherSection.style.display = "block";
  if (elements.reevaluationTeacherReason) elements.reevaluationTeacherReason.textContent = req.reason || "None";
  if (elements.reevalRevisedGrade) elements.reevalRevisedGrade.value = req.previous_grade !== null ? req.previous_grade : "";
  if (elements.reevalDecisionNotes) elements.reevalDecisionNotes.value = "";
  if (elements.reevaluationModalBackdrop) elements.reevaluationModalBackdrop.style.display = "flex";
}

async function handleSubmitReevaluationRequest() {
  if (!currentWorkflowSubmission) return;
  const reasonVal = elements.reevalReasonInput ? elements.reevalReasonInput.value.trim() : "";
  if (!reasonVal || reasonVal.length < 5) {
    showToast("Please provide a specific reason for re-evaluation (at least 5 characters).", "warning");
    return;
  }

  try {
    const res = await fetch(API_ENDPOINTS.workflow.requestReevaluation(currentWorkflowSubmission.id), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ reason: reasonVal })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Failed to submit re-evaluation request.", "error");
      return;
    }
    showToast("Re-evaluation request submitted to instructor.", "success");
    closeReevaluationModal();
  } catch (e) {
    showToast("Network error submitting re-evaluation request.", "error");
  }
}

async function handleSubmitReevaluationDecision() {
  if (!currentReevaluationRequest) return;
  const decisionVal = elements.reevalDecisionSelect ? elements.reevalDecisionSelect.value : "approved";
  const revisedGradeVal = elements.reevalRevisedGrade ? parseFloat(elements.reevalRevisedGrade.value) : null;
  const notesVal = elements.reevalDecisionNotes ? elements.reevalDecisionNotes.value.trim() : null;

  try {
    const res = await fetch(API_ENDPOINTS.workflow.reevaluationDecision(currentReevaluationRequest.id), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        status: decisionVal,
        revised_grade: decisionVal === "approved" ? revisedGradeVal : null,
        decision_notes: notesVal
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Failed to record decision.", "error");
      return;
    }
    showToast("Re-evaluation decision recorded.", "success");
    closeReevaluationModal();
    if (state.currentGradingAssignment) {
      await fetchTeacherSubmissions(state.currentGradingAssignment);
      if (elements.gradingWorkspaceModalBackdrop && elements.gradingWorkspaceModalBackdrop.style.display === "flex") {
        openGradingWorkspace(state.currentGradingIndex);
      }
    }
  } catch (e) {
    showToast("Network error", "error");
  }
}

// Finalization
async function openFinalizeModal() {
  if (!currentAnalyticsClassId || !currentAnalyticsSubject) {
    showToast("Please select a class and subject first.", "warning");
    return;
  }
  if (elements.finalizeAlert) elements.finalizeAlert.style.display = "none";
  if (elements.finalizeNotesInput) elements.finalizeNotesInput.value = "";

  const asgns = (state.assignments || []).filter(a => a.class_id == currentAnalyticsClassId && a.subject === currentAnalyticsSubject);
  const units = [...new Set(asgns.map(a => a.unit || 1))].sort((a,b) => a-b);

  if (elements.finalizeUnitsChecklist) {
    elements.finalizeUnitsChecklist.innerHTML = units.map(u => `
      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
        <input type="checkbox" class="finalize-unit-check" value="${u}" checked>
        <span>Unit ${u} (Required)</span>
      </label>
    `).join("");
  }

  if (elements.finalizeModalBackdrop) elements.finalizeModalBackdrop.style.display = "flex";
}

async function handleConfirmFinalize() {
  const checkedUnits = Array.from(document.querySelectorAll(".finalize-unit-check:checked"))
    .map(cb => parseInt(cb.value, 10))
    .filter(n => !isNaN(n));
  const auditNotes = elements.finalizeNotesInput ? elements.finalizeNotesInput.value.trim() || null : null;

  try {
    const res = await fetch(API_ENDPOINTS.workflow.finalize(currentAnalyticsClassId, currentAnalyticsSubject), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        required_units: checkedUnits.length > 0 ? checkedUnits : [1],
        notes: auditNotes
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Failed to finalize results.", "error");
      return;
    }
    showToast("Subject results successfully finalized and locked.", "success");
    if (elements.finalizeModalBackdrop) elements.finalizeModalBackdrop.style.display = "none";
    await refreshAnalyticsData();
  } catch (e) {
    showToast("Network error", "error");
  }
}

// Leaderboard & Reports
async function toggleLeaderboard() {
  if (!elements.analyticsLeaderboardCard) return;
  const isHidden = elements.analyticsLeaderboardCard.style.display === "none";

  if (isHidden) {
    if (!currentAnalyticsSubject) {
      showToast("Please select a subject to view the leaderboard.", "warning");
      return;
    }
    try {
      const res = await fetch(API_ENDPOINTS.analytics.leaderboard(currentAnalyticsClassId, currentAnalyticsSubject), {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (res.ok) {
        const resData = await res.json();
        const board = Array.isArray(resData) ? resData : (resData.leaderboard || []);
        if (elements.analyticsLeaderboardBody) {
          if (!board.length) {
            elements.analyticsLeaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No student results available for this leaderboard.</td></tr>`;
          } else {
            elements.analyticsLeaderboardBody.innerHTML = board.map(b => `
              <tr style="${(b.is_self || b.is_current_user) ? 'background: #eff6ff; font-weight: 600;' : ''}">
                <td><strong>#${b.rank}</strong></td>
                <td>${escapeHtml(b.display_name)}${(b.is_self || b.is_current_user) ? ' <span class="badge" style="background:#2563eb; color:#fff; font-size:0.7rem; padding:0.1rem 0.4rem; border-radius:4px;">You</span>' : ''}</td>
                <td style="color: #2563eb; font-weight: 700;">${(b.percentage ?? b.score) !== null && (b.percentage ?? b.score) !== undefined ? (b.percentage ?? b.score) + '%' : '—'}</td>
                <td>${b.units_completed ?? b.completed_units ?? 0}</td>
              </tr>
            `).join("");
          }
        }
        elements.analyticsLeaderboardCard.style.display = "block";
      }
    } catch (e) {
      showToast("Failed to load class leaderboard", "error");
    }
  } else {
    elements.analyticsLeaderboardCard.style.display = "none";
  }
}

function handleDownloadSummaryCsv() {
  if (!currentAnalyticsClassId) {
    showToast("Select a class first.", "warning");
    return;
  }
  window.open(API_ENDPOINTS.analytics.summaryCsv(currentAnalyticsClassId), "_blank");
}

function handleDownloadDetailedCsv() {
  if (!currentAnalyticsClassId) {
    showToast("Select a class first.", "warning");
    return;
  }
  if (!currentAnalyticsSubject) {
    showToast("Please select a specific subject to download detailed results.", "warning");
    return;
  }
  window.open(API_ENDPOINTS.analytics.detailedCsv(currentAnalyticsClassId, currentAnalyticsSubject), "_blank");
}


// ==========================================================================
// API Interaction Functions
// ==========================================================================

/**
 * Fetches all assignments from the PostgreSQL database via FastAPI
 */
async function fetchAssignments() {
  showLoadingState();
  const epoch = state.authEpoch;
  const user = state.currentUser;

  try {
    const response = await fetch(API_ENDPOINTS.assignments, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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

  const epoch = state.authEpoch;
  const id = state.deletePendingId;
  elements.confirmDeleteBtn.disabled = true;
  elements.confirmDeleteBtn.textContent = "Deleting...";

  try {
    const response = await fetch(`${API_ENDPOINTS.assignments}/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
function getEffectiveStatus(assignment, studentSubmission) {
  if (!assignment) return "active";

  const isStudent = (state.currentUser && state.currentUser.role === "student") || studentSubmission !== undefined;
  const mySub = studentSubmission !== undefined
    ? studentSubmission
    : (isStudent && state.mySubmissions ? state.mySubmissions[assignment.id] : null);

  // Student perspective
  if (isStudent) {
    if (mySub) {
      // 1. Resubmission authorized check
      const resubAllowed = Boolean(mySub.resubmission_allowed);
      let isResubExpired = false;
      if (resubAllowed && mySub.resubmission_deadline) {
        isResubExpired = new Date(mySub.resubmission_deadline).getTime() < Date.now();
      }
      if (resubAllowed && !isResubExpired) {
        return "resubmit";
      }

      // 2. Graded check
      if (mySub.status === "released" || (mySub.grade !== null && mySub.grade !== undefined)) {
        return "graded";
      }

      // 3. Submitted check (never overdue once submitted!)
      return "submitted";
    }

    // Student has not submitted:
    const dueDate = new Date(assignment.due_date);
    const now = new Date();
    const isPastDue = !isNaN(dueDate.getTime()) && dueDate < now;

    if (isPastDue || assignment.status === "overdue" || assignment.status === "closed") {
      return "overdue";
    }
    if (assignment.status === "completed") {
      return "completed";
    }
    return "not_submitted";
  }

  // Teacher perspective
  // Rule 1: Draft assignments
  if (assignment.status === "draft") {
    return "draft";
  }

  // Rule 2: Completed / Closed assignments
  if (assignment.status === "completed" || assignment.status === "closed") {
    return "completed";
  }

  // Rule 3: Overdue assignments
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  const isPastDue = !isNaN(dueDate.getTime()) && dueDate < now;
  if (isPastDue || assignment.status === "overdue") {
    return "overdue";
  }

  // Rule 4: Active
  return "active";
}

/**
 * Dynamically synchronizes status filter dropdown options based on current user role
 */
function syncStatusFilterOptions() {
  if (!elements.statusFilter) return;
  const isStudent = state.currentUser && state.currentUser.role === "student";
  const curVal = elements.statusFilter.value;
  if (isStudent) {
    elements.statusFilter.innerHTML = `
      <option value="all">All Status</option>
      <option value="not_submitted">Not Submitted</option>
      <option value="submitted">Submitted</option>
      <option value="graded">Graded</option>
      <option value="resubmit">Needs Resubmission</option>
    `;
  } else {
    elements.statusFilter.innerHTML = `
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="draft">Draft</option>
      <option value="completed">Completed</option>
      <option value="overdue">Overdue</option>
    `;
  }
  if (Array.from(elements.statusFilter.options).some((o) => o.value === curVal)) {
    elements.statusFilter.value = curVal;
  } else {
    elements.statusFilter.value = "all";
    state.filters.status = "all";
  }
}

/**
 * Updates the 4 statistics summary cards dynamically
 */
function updateStatistics(assignments) {
  const isStudent = state.currentUser && state.currentUser.role === "student";
  const total = assignments.length;
  let activeCount = 0;
  let completedCount = 0;
  let overdueCount = 0;

  assignments.forEach((assignment) => {
    const status = getEffectiveStatus(assignment);
    if (isStudent) {
      if (status === "submitted" || status === "graded") {
        completedCount++;
      } else if (status === "overdue") {
        overdueCount++;
      } else {
        // "not_submitted", "resubmit", "active"
        activeCount++;
      }
    } else {
      if (status === "active") activeCount++;
      else if (status === "completed") completedCount++;
      else if (status === "overdue") overdueCount++;
    }
  });

  if (elements.statTotalCount) elements.statTotalCount.textContent = total;
  if (elements.statActiveCount) elements.statActiveCount.textContent = activeCount;
  if (elements.statCompletedCount) elements.statCompletedCount.textContent = completedCount;
  if (elements.statOverdueCount) elements.statOverdueCount.textContent = overdueCount;
}

// ==========================================================================
// Filter, Search, and Sort Engine
// ==========================================================================

function applyFiltersAndRender() {
  syncStatusFilterOptions();
  const isStudent = state.currentUser && state.currentUser.role === "student";
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
      if (isStudent) {
        if (status === "not_submitted") {
          return effectiveStatus === "not_submitted" || effectiveStatus === "overdue";
        }
        return effectiveStatus === status;
      }
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
        : "No assignments are currently available. Join a class using your instructor's join code to access upcoming coursework.";
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
      : (isTeacher ? `<span class="class-pill unassigned-pill" title="Private teacher draft: not visible to students until assigned to a class">Unassigned (Draft)</span>` : "");

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
        const resubAllowed = Boolean(mySub.resubmission_allowed);
        let isResubExpired = false;
        if (resubAllowed && mySub.resubmission_deadline) {
          isResubExpired = new Date(mySub.resubmission_deadline).getTime() < Date.now();
        }

        const resubmitBtn = (resubAllowed && !isResubExpired)
          ? `<button class="btn btn-sm btn-warning resubmit-work-btn" data-id="${assignment.id}" title="Teacher authorized resubmission: click to submit a revised attempt" style="padding: 0.25rem 0.65rem; font-size: 0.775rem; font-weight: 600;">
               ↻ Resubmit
             </button>`
          : "";

        actionsHtml = `
          <div class="action-btn-group">
            ${downloadActionBtn}
            ${resubmitBtn}
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
      const resubAllowed = Boolean(mySub.resubmission_allowed);
      let isResubExpired = false;
      if (resubAllowed && mySub.resubmission_deadline) {
        isResubExpired = new Date(mySub.resubmission_deadline).getTime() < Date.now();
      }

      let resubBadge = "";
      if (resubAllowed) {
        if (!isResubExpired) {
          const dlHint = mySub.resubmission_deadline ? ` until ${formatDisplayDate(mySub.resubmission_deadline)}` : "";
          resubBadge = `<span class="submission-pill status-resubmit-allowed" title="Resubmission permitted by teacher${dlHint}">↻ Resubmission Permitted</span>`;
        } else {
          resubBadge = `<span class="submission-pill status-resubmit-expired" title="Resubmission deadline passed on ${formatDisplayDate(mySub.resubmission_deadline)}">Resubmission Expired</span>`;
        }
      }

      let gradeBadge = "";
      if (mySub.status === "released" && mySub.grade !== null && mySub.grade !== undefined) {
        gradeBadge = `<span class="submission-pill status-released" title="Grade Released: ${mySub.grade}/${mySub.max_marks || 100}">Score: ${mySub.grade}/${mySub.max_marks || 100}</span>`;
      } else {
        gradeBadge = mySub.is_late
          ? `<span class="submission-pill status-late" title="Submitted Late on ${formatDisplayDate(mySub.submitted_at)}">✓ Late (In Review)</span>`
          : `<span class="submission-pill status-ungraded" title="Submitted on ${formatDisplayDate(mySub.submitted_at)}">✓ Pending Review</span>`;
      }

      if (resubBadge) {
        studentSubBadge = `<div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">${gradeBadge}${resubBadge}</div>`;
      } else {
        studentSubBadge = gradeBadge;
      }
    }

    let teacherProgressBadge = "";
    if (isTeacher) {
      if (assignment.class_id) {
        const subCount = assignment.submission_count !== undefined ? assignment.submission_count : 0;
        const totalStudents = assignment.total_students !== undefined ? assignment.total_students : 0;
        const pct = totalStudents > 0 ? Math.min(100, Math.round((subCount / totalStudents) * 100)) : 0;
        teacherProgressBadge = `
          <div class="submission-progress-chip" title="${subCount} of ${totalStudents} students submitted (${pct}%)">
            <span class="progress-counts">${subCount}/${totalStudents} submitted</span>
            <div class="progress-bar-mini" aria-hidden="true">
              <div class="progress-fill-mini" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      } else {
        teacherProgressBadge = `<span class="submission-progress-chip unassigned">Draft (0 enrolled)</span>`;
      }
    }

    let statusBadgeHtml = "";
    if (isStudent) {
      if (effectiveStatus === "resubmit") {
        statusBadgeHtml = `<span class="status-pill status-resubmit">↻ Needs Resubmission</span>`;
      } else if (effectiveStatus === "graded") {
        statusBadgeHtml = `<span class="status-pill status-graded">✓ Graded</span>`;
      } else if (effectiveStatus === "submitted") {
        statusBadgeHtml = `<span class="status-pill status-submitted">✓ Submitted</span>`;
      } else if (effectiveStatus === "overdue") {
        statusBadgeHtml = `<span class="status-pill status-overdue">Missing (Overdue)</span>`;
      } else {
        statusBadgeHtml = `<span class="status-pill status-not-submitted">Not Submitted</span>`;
      }
    } else {
      statusBadgeHtml = `<span class="status-pill status-${effectiveStatus}">${capitalize(effectiveStatus)}</span>`;
    }

    tr.innerHTML = `
      <td class="col-num">${index + 1}</td>
      <td class="col-title" title="${escapeHtml(assignment.description || assignment.title)}">
        <span class="title-text">${escapeHtml(assignment.title)}</span>
        <span class="marks-chip" title="Maximum Marks: ${assignment.max_marks || 100}">${assignment.max_marks || 100} pts</span>
        ${pdfBadge}
      </td>
      <td class="col-subject">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
          <span>${escapeHtml(assignment.subject)}</span>
          <span class="unit-badge">Unit ${assignment.unit || 1}</span>
          ${classBadge}
        </div>
      </td>
      <td class="col-due">${formattedDate}</td>
      <td class="col-status">
        <div style="display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start;">
          ${statusBadgeHtml}
          ${isTeacher ? teacherProgressBadge : studentSubBadge}
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
    const resubmitBtn = tr.querySelector(".resubmit-work-btn");
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
    if (resubmitBtn) {
      resubmitBtn.addEventListener("click", () => openSubmitWorkModal(assignment, mySub));
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
  const epoch = state.authEpoch;

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
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
 * Role-based route authorization.
 * Returns true if the user's role has permission to access the target route.
 */
function canUserAccessRoute(user, route) {
  const normalized = (route || "").toLowerCase().trim();
  if (["privacy", "terms"].includes(normalized)) return true;
  if (!user || !user.role) return false;

  // Extract base route segment for parameterized subpaths like classes/12 or subjects/12
  const baseSegment = normalized.split("/")[0];
  const canonicalRoute = baseSegment === "subjects" ? "classes" : (baseSegment === "students" ? "submissions" : baseSegment);

  if (!SUPPORTED_VIEWS.includes(canonicalRoute) && !SUPPORTED_VIEWS.includes(baseSegment) && !SUPPORTED_VIEWS.includes(normalized)) {
    return false;
  }

  const rolePermissions = {
    teacher: ["dashboard", "semesters", "assignments", "classes", "submissions", "reports", "calendar", "analytics", "settings", "privacy", "terms"],
    student: ["dashboard", "assignments", "classes", "submissions", "calendar", "analytics", "settings", "privacy", "terms"],
  };

  const allowedRoutes = rolePermissions[user.role] || ["dashboard"];
  return allowedRoutes.includes(canonicalRoute);
}

/**
 * Completely clears all in-memory user-specific state, aborts in-flight requests,
 * closes all modals/drawers, empties DOM tables/containers, and resets navigation to #dashboard.
 */
function clearUserState() {
  // Invalidate any in-flight asynchronous requests from previous session
  if (state.activeAbortController) {
    try {
      state.activeAbortController.abort();
    } catch (_) {}
  }
  state.activeAbortController = new AbortController();
  state.authEpoch = (state.authEpoch || 0) + 1;

  // Clear in-memory and persistent user-specific state
  setAuthToken(null);
  state.currentUser = null;
  state.assignments = [];
  state.filteredAssignments = [];
  state.classes = [];
  state.mySubmissions = {};
  state.submissionsData = [];
  state.editingId = null;
  state.deletePendingId = null;
  state.currentSubmittingAssignment = null;
  state.currentSubmittingExistingSubmission = null;
  state.currentViewingAssignment = null;
  state.currentViewingSubmission = null;
  state.currentGradingAssignment = null;
  state.currentGradingSubmissions = [];
  state.currentGradingIndex = 0;
  state.pendingSingleReleaseSubId = null;
  state.isGradingSaving = false;
  if (state.selectedSubmissionIds) {
    state.selectedSubmissionIds.clear();
  } else {
    state.selectedSubmissionIds = new Set();
  }
  state.filters = {
    search: "",
    classId: "all",
    subject: "all",
    unit: "all",
    status: "all",
    sort: "newest",
  };

  // Clear module-level variables
  currentExtensionAssignmentId = null;
  currentWorkflowSubmission = null;
  currentReevaluationRequest = null;
  currentAnalyticsClassId = null;
  currentAnalyticsSubject = "";

  // Close all open modals, drawers, and menus to prevent background bleed
  try { closeProfileMenu(); } catch (_) {}
  try { closeDrawer(); } catch (_) {}
  try { closeDeleteModal(); } catch (_) {}
  try { closeSidebar(); } catch (_) {}
  try { closeClassesModal(); } catch (_) {}
  try { closeSubmitWorkModal(); } catch (_) {}
  try { closeViewSubmissionModal(); } catch (_) {}
  try { closeTeacherSubmissionsModal(); } catch (_) {}
  try { closeSubmissionPreviewModal(); } catch (_) {}
  try {
    if (elements.gradingWorkspaceModalBackdrop) elements.gradingWorkspaceModalBackdrop.style.display = "none";
    if (elements.gradingPdfIframe) elements.gradingPdfIframe.src = "about:blank";
    if (elements.gradingPdfSpinner) elements.gradingPdfSpinner.style.display = "none";
  } catch (_) {}
  try { closeGradeCorrectionModal(); } catch (_) {}
  try { closeResubmissionModal(); } catch (_) {}
  try { closeReevaluationModal(); } catch (_) {}
  try { closeSubmissionHistoryModal(); } catch (_) {}
  try { closeSingleReleaseModal(); } catch (_) {}
  try { closeBulkReleaseModal(); } catch (_) {}
  try { closeStructureModal(); } catch (_) {}
  if (elements.notificationMenu) elements.notificationMenu.style.display = "none";

  // Clear role/user-specific DOM tables and containers
  if (elements.submissionsTableHead) elements.submissionsTableHead.innerHTML = "";
  if (elements.submissionsTableBody) elements.submissionsTableBody.innerHTML = "";
  if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "none";
  if (elements.submissionsLoadingState) elements.submissionsLoadingState.style.display = "none";
  if (elements.classesPageContent) elements.classesPageContent.innerHTML = "";
  if (elements.tableBody) elements.tableBody.innerHTML = "";
  if (elements.dashMetricsRow) elements.dashMetricsRow.innerHTML = "";
  if (elements.dashDueAssignmentsList) elements.dashDueAssignmentsList.innerHTML = "";
  if (elements.dashRecentSubmissionsList) elements.dashRecentSubmissionsList.innerHTML = "";
  if (elements.analyticsKpiRow) elements.analyticsKpiRow.innerHTML = "";
  if (elements.analyticsRankingsBody) elements.analyticsRankingsBody.innerHTML = "";
  if (elements.analyticsUnitComparisonsBody) elements.analyticsUnitComparisonsBody.innerHTML = "";
  if (elements.analyticsStudentFeedbackBody) elements.analyticsStudentFeedbackBody.innerHTML = "";
  if (elements.analyticsLeaderboardBody) elements.analyticsLeaderboardBody.innerHTML = "";
  if (elements.analyticsAlertsContainer) {
    elements.analyticsAlertsContainer.innerHTML = "";
    elements.analyticsAlertsContainer.style.display = "none";
  }
  if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";
  if (elements.analyticsStudentFeedbackCard) elements.analyticsStudentFeedbackCard.style.display = "none";
  if (elements.analyticsFinalizedBadge) elements.analyticsFinalizedBadge.style.display = "none";
  state.analyticsOverviewData = null;
  state.analyticsRankingsData = null;
  if (elements.notificationList) {
    elements.notificationList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.85rem;">No notifications</div>';
  }
  if (elements.notificationBadge) elements.notificationBadge.style.display = "none";

  populateClassFilterOptions([]);
  populateFormClassOptions([]);
  if (elements.globalSearchInput) elements.globalSearchInput.value = "";
  if (elements.tableSearchInput) elements.tableSearchInput.value = "";

  updateUserUI(null);
  renderTable([]);
  updateStatistics([]);

  // Reset navigation to default dashboard view
  state.activeView = "dashboard";
  if (window.location.hash !== "#dashboard" && window.location.hash !== "") {
    try {
      history.replaceState(null, "", "#dashboard");
    } catch (_) {
      window.location.hash = "#dashboard";
    }
  }
  document.querySelectorAll(".page-view").forEach((viewEl) => {
    viewEl.style.display = "none";
  });
  const dashView = document.getElementById("dashboardView");
  if (dashView) dashView.style.display = "flex";
  elements.navLinks.forEach((link) => link.classList.remove("active"));
  const dashLink = document.querySelector('.nav-link[data-nav="dashboard"]');
  if (dashLink) dashLink.classList.add("active");
}

/**
 * Fully establishes an authenticated user session:
 * 1. Resolves identity and role
 * 2. Updates user UI and sidebar elements
 * 3. Fetches user metadata (classes, notifications)
 * 4. Checks route authorization and navigates cleanly without refresh
 */
async function applyAuthenticatedUserSession(user, preferredRoute = null) {
  if (!user || !user.role) {
    throw new Error("Unable to resolve user identity or role.");
  }

  // Cancel prior in-flight requests and increment auth epoch
  if (state.activeAbortController) {
    try {
      state.activeAbortController.abort();
    } catch (_) {}
  }
  state.activeAbortController = new AbortController();
  const currentEpoch = (state.authEpoch || 0) + 1;
  state.authEpoch = currentEpoch;

  state.currentUser = user;
  updateUserUI(user);

  // Fetch initial classes and notifications
  await Promise.allSettled([
    fetchClasses(),
    fetchNotifications(),
  ]);

  // Ensure session has not changed during async fetch
  if (state.authEpoch !== currentEpoch || state.currentUser?.id !== user.id) {
    return;
  }

  // Determine target route: check authorization for the role
  const rawRoute = (preferredRoute || window.location.hash || "").replace(/^#\/?/, "").toLowerCase() || "dashboard";
  const targetRoute = canUserAccessRoute(user, rawRoute) ? rawRoute : "dashboard";

  // Navigate to resolved route and trigger role-specific view loader
  navigateToView(targetRoute, true);
}



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
  const epoch = ++state.authEpoch;
  try {
    const res = await fetch(API_ENDPOINTS.authMe, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
      const rawRoute = (window.location.hash || "").replace(/^#\/?/, "") || (window.location.pathname || "").replace(/^\//, "");
      if (["privacy", "terms"].includes(rawRoute.toLowerCase())) {
        navigateToView(rawRoute.toLowerCase(), false);
      } else {
        openAuthModal("signin");
      }
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    setAuthToken(null);
    state.currentUser = null;
    updateUserUI(null);
    const rawRoute = (window.location.hash || "").replace(/^#\/?/, "") || (window.location.pathname || "").replace(/^\//, "");
    if (["privacy", "terms"].includes(rawRoute.toLowerCase())) {
      navigateToView(rawRoute.toLowerCase(), false);
    } else {
      openAuthModal("signin");
    }
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
      if (elements.topNavTextAnalytics) elements.topNavTextAnalytics.textContent = "Analytics";
      if (elements.globalSearchInput) elements.globalSearchInput.placeholder = "Search assignments, classes, students...";
    } else {
      if (elements.navTextAssignments) elements.navTextAssignments.textContent = "My Assignments";
      if (elements.navTextClasses) elements.navTextClasses.textContent = "My Classes";
      if (elements.navTextSubmissions) elements.navTextSubmissions.textContent = "My Submissions";
      if (elements.navTextAnalytics) elements.navTextAnalytics.textContent = "Results";
      if (elements.topNavTextAnalytics) elements.topNavTextAnalytics.textContent = "Results";
      if (elements.globalSearchInput) elements.globalSearchInput.placeholder = "Search assignments, classes, subjects...";
    }

    // Role-based visibility
    const teacherNavItems = document.querySelectorAll('.nav-item[data-role="teacher"]');
    if (user.role === "teacher") {
      teacherNavItems.forEach((item) => { item.style.display = ""; });
      if (elements.openCreateDrawerBtn) elements.openCreateDrawerBtn.style.display = "inline-flex";
      if (elements.mobileFabBtn) elements.mobileFabBtn.style.display = "flex";
      if (elements.emptyStateCreateBtn) elements.emptyStateCreateBtn.style.display = "inline-flex";
      if (elements.openClassesModalBtn) elements.openClassesModalBtn.style.display = "inline-flex";
      if (elements.openStructureModalBtn) elements.openStructureModalBtn.style.display = "inline-flex";
      if (elements.classesBtnText) elements.classesBtnText.textContent = "My Classes";
      if (elements.formClassGroup) elements.formClassGroup.style.display = "flex";
    } else {
      // Student
      teacherNavItems.forEach((item) => { item.style.display = "none"; });
      if (elements.openCreateDrawerBtn) elements.openCreateDrawerBtn.style.display = "none";
      if (elements.mobileFabBtn) elements.mobileFabBtn.style.display = "none";
      if (elements.emptyStateCreateBtn) elements.emptyStateCreateBtn.style.display = "none";
      if (elements.openClassesModalBtn) elements.openClassesModalBtn.style.display = "inline-flex";
      if (elements.openStructureModalBtn) elements.openStructureModalBtn.style.display = "inline-flex";
      if (elements.classesBtnText) elements.classesBtnText.textContent = "My Classes";
      if (elements.formClassGroup) elements.formClassGroup.style.display = "none";
    }
  } else {
    // Unauthenticated Guest
    const teacherNavItems = document.querySelectorAll('.nav-item[data-role="teacher"]');
    teacherNavItems.forEach((item) => { item.style.display = "none"; });

    if (elements.navTextAnalytics) elements.navTextAnalytics.textContent = "Analytics";
    if (elements.topNavTextAnalytics) elements.topNavTextAnalytics.textContent = "Analytics";
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
    if (elements.openStructureModalBtn) elements.openStructureModalBtn.style.display = "none";
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
  "privacy",
  "terms",
];

/**
 * Switch primary view and keep URL hash + sidebar synchronized
 */
function navigateToView(viewName, updateHash = true) {
  const fullInput = (viewName || "").trim();
  const qIndex = fullInput.indexOf("?");
  let rawBase = qIndex >= 0 ? fullInput.substring(0, qIndex) : fullInput;
  let queryString = qIndex >= 0 ? fullInput.substring(qIndex + 1) : "";

  let rawView = rawBase.toLowerCase().trim();
  let targetView = rawView;

  // Handle parameterized routes like classes/12 or subjects/12
  const subjectParamMatch = targetView.match(/^(?:classes|subjects)\/(\d+)/i);
  let targetSubjectId = null;
  if (subjectParamMatch) {
    targetSubjectId = parseInt(subjectParamMatch[1], 10);
    targetView = "classes";
  }

  // Handle aliases
  if (targetView === "subjects") targetView = "classes";
  if (targetView === "students") targetView = "submissions";
  if (targetView === "notifications") {
    targetView = "dashboard";
    if (elements.notificationMenu) {
      elements.notificationMenu.style.display = "block";
      fetchNotifications();
    }
  }

  if (!SUPPORTED_VIEWS.includes(targetView) && !SUPPORTED_VIEWS.includes(rawView)) {
    targetView = "dashboard";
    rawView = "dashboard";
    queryString = "";
  }

  if (state.currentUser && !canUserAccessRoute(state.currentUser, targetView)) {
    targetView = "dashboard";
    rawView = "dashboard";
    targetSubjectId = null;
    queryString = "";
  }
  state.activeView = targetView;
  state.currentView = targetView;

  if (updateHash) {
    const newHash = `#${rawView}${queryString ? "?" + queryString : ""}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 3. Synchronize active highlight across top navbar and drawer
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  document.querySelectorAll(`.nav-link[data-nav="${rawView}"], .nav-link[data-nav="${targetView}"]`).forEach((link) => {
    link.classList.add("active");
  });

  // Safe parameter parser for supported query params
  const searchParams = new URLSearchParams(queryString);

  // 4. Trigger view-specific data loading
  if (targetView === "dashboard") {
    fetchDashboard();
  } else if (targetView === "semesters") {
    loadSemestersPageView();
  } else if (targetView === "assignments") {
    fetchAssignments().then(() => {
      if (searchParams.has("resubmit")) {
        const asgnId = parseInt(searchParams.get("resubmit"), 10);
        if (!isNaN(asgnId)) {
          const asgn = (state.assignments || []).find((a) => a.id === asgnId);
          if (asgn) {
            const mySub = state.mySubmissions ? state.mySubmissions[asgn.id] : null;
            openSubmitWorkModal(asgn, mySub);
          }
        }
      } else if (searchParams.has("view_result")) {
        const asgnId = parseInt(searchParams.get("view_result"), 10);
        if (!isNaN(asgnId)) {
          const asgn = (state.assignments || []).find((a) => a.id === asgnId);
          if (asgn) {
            const mySub = state.mySubmissions ? state.mySubmissions[asgn.id] : null;
            if (mySub) openViewSubmissionModal(asgn, mySub);
          }
        }
      }
    });
  } else if (targetView === "classes") {
    if (targetSubjectId) {
      state.activeSubjectId = targetSubjectId;
    } else {
      state.activeSubjectId = null;
      state.activeSubject = null;
      state.activeSubjectTab = null;
    }
    loadClassesPageView();
  } else if (targetView === "submissions") {
    if (searchParams.has("status") || searchParams.has("queue")) {
      const q = searchParams.get("status") || searchParams.get("queue");
      if (elements.submissionsStatusFilter) {
        elements.submissionsStatusFilter.value = q;
      }
    }
    loadSubmissionsPageView().then(() => {
      if (searchParams.has("sub")) {
        const subId = parseInt(searchParams.get("sub"), 10);
        if (!isNaN(subId) && state.submissionsData) {
          const foundIdx = state.submissionsData.findIndex((s) => s.id === subId);
          if (foundIdx >= 0) {
            const s = state.submissionsData[foundIdx];
            state.currentGradingAssignment = {
              id: s.assignment_id,
              title: s.assignment_title,
              class_name: s.class_name,
              max_marks: 100,
            };
            state.currentGradingSubmissions = state.submissionsData;
            state.currentGradingIndex = foundIdx;
            openGradingWorkspace(foundIdx);
          }
        }
      }
    });
  } else if (targetView === "reports") {
    loadReportsPageView();
  } else if (targetView === "calendar") {
    if (searchParams.has("date")) {
      const parsedDate = new Date(searchParams.get("date"));
      if (!isNaN(parsedDate.getTime())) {
        calendarNavYear = parsedDate.getFullYear();
        calendarNavMonth = parsedDate.getMonth();
        calendarSelectedDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      }
    }
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
  if (elements.classesPageActionBtn) {
    elements.classesPageActionBtn.title = isTeacher ? "Create Class" : "Join Class";
    elements.classesPageActionBtn.setAttribute("aria-label", isTeacher ? "Create Class" : "Join Class");
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
                    ${(isTeacher && cls.join_code) ? `
                      <span class="class-join-code-badge" onclick="event.stopPropagation(); copyJoinCode('${escapeHtml(cls.join_code)}')" title="Click to copy join code">
                        <span>${escapeHtml(cls.join_code)}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                      </span>
                    ` : (!isTeacher ? `
                      <span class="class-join-code-badge class-enrolled-badge" style="background: rgba(40,87,71,0.08); color: var(--primary); border-color: rgba(40,87,71,0.2); cursor: default;" title="Enrolled course">
                        <span>Enrolled</span>
                      </span>
                    ` : '')}
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
            ${isTeacher ? `
            <button class="btn-class-students" type="button" onclick="event.stopPropagation(); viewSubjectDetail(${cls.id}, 'students')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <span>Students</span>
            </button>
            ` : `
            <button class="btn-class-results" type="button" onclick="event.stopPropagation(); navigateToView('analytics')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Results</span>
            </button>
            `}
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
  const epoch = state.authEpoch;

  const isTeacher = state.currentUser?.role === "teacher";
  if (elements.submissionsPageTitle) {
    elements.submissionsPageTitle.textContent = isTeacher ? "Submissions & Work Queue" : "My Submissions";
  }
  if (elements.submissionsPageSubtitle) {
    elements.submissionsPageSubtitle.textContent = isTeacher
      ? "Review student submitted work, grade pending submissions, manage draft grades, and decide re-evaluations."
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

  // Wire up Work Queue Tabs for Teachers
  if (elements.submissionsQueueTabs && !elements.submissionsQueueTabs.dataset.wired) {
    elements.submissionsQueueTabs.dataset.wired = "true";
    elements.submissionsQueueTabs.querySelectorAll(".queue-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const queueVal = tab.getAttribute("data-queue");
        if (elements.submissionsStatusFilter) {
          elements.submissionsStatusFilter.value = queueVal;
        }
        elements.submissionsQueueTabs.querySelectorAll(".queue-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        filterAndRenderSubmissions();
      });
    });
  }

  if (elements.submissionsStatusFilter && !elements.submissionsStatusFilter.dataset.tabWired) {
    elements.submissionsStatusFilter.dataset.tabWired = "true";
    elements.submissionsStatusFilter.addEventListener("change", () => {
      const val = elements.submissionsStatusFilter.value;
      if (elements.submissionsQueueTabs) {
        elements.submissionsQueueTabs.querySelectorAll(".queue-tab").forEach((t) => {
          t.classList.toggle("active", t.getAttribute("data-queue") === val);
        });
      }
      filterAndRenderSubmissions();
    });
  }

  if (elements.submissionsLoadingState) elements.submissionsLoadingState.style.display = "flex";
  if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "none";
  if (elements.submissionsTableBody) elements.submissionsTableBody.innerHTML = "";

  try {
    const res = await fetch(API_ENDPOINTS.submissions, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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

function updateTeacherQueueTabs() {
  if (!elements.submissionsQueueTabs) return;
  const isTeacher = state.currentUser?.role === "teacher";
  if (!isTeacher) {
    elements.submissionsQueueTabs.style.display = "none";
    return;
  }
  elements.submissionsQueueTabs.style.display = "flex";

  const all = state.submissionsData || [];
  const needsGradingCount = all.filter((s) => s.grade === null || s.grade === undefined || s.status === "submitted" || s.status === "pending_review").length;
  const draftGradesCount = all.filter((s) => (s.grade !== null && s.grade !== undefined) && s.status !== "released").length;
  const reevalCount = all.filter((s) => s.needs_reevaluation === true || Boolean(s.reevaluation_reason) || Boolean(s.reevaluation_id)).length;
  const releasedCount = all.filter((s) => s.status === "released").length;

  if (elements.countQueueAll) elements.countQueueAll.textContent = all.length;
  if (elements.countQueueNeedsGrading) elements.countQueueNeedsGrading.textContent = needsGradingCount;
  if (elements.countQueueDraftGrades) elements.countQueueDraftGrades.textContent = draftGradesCount;
  if (elements.countQueueReeval) elements.countQueueReeval.textContent = reevalCount;
  if (elements.countQueueReleased) elements.countQueueReleased.textContent = releasedCount;

  // Sync tab active class with select dropdown
  const currentFilter = elements.submissionsStatusFilter?.value || "all";
  elements.submissionsQueueTabs.querySelectorAll(".queue-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-queue") === currentFilter);
  });
}

function filterAndRenderSubmissions() {
  updateTeacherQueueTabs();
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

  // Work Queue filters
  if (statusFilter === "needs_grading") {
    list = list.filter((s) => s.grade === null || s.grade === undefined || s.status === "submitted" || s.status === "pending_review");
  } else if (statusFilter === "draft_grades") {
    list = list.filter((s) => (s.grade !== null && s.grade !== undefined) && s.status !== "released");
  } else if (statusFilter === "pending_reevaluation") {
    list = list.filter((s) => s.needs_reevaluation === true || Boolean(s.reevaluation_reason) || Boolean(s.reevaluation_id));
  } else if (statusFilter === "released") {
    list = list.filter((s) => s.status === "released");
  } else if (statusFilter === "ontime") {
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
      if (search) {
        elements.submissionsEmptyText.textContent = "Try adjusting your search query or filter.";
      } else if (statusFilter === "needs_grading") {
        elements.submissionsEmptyText.textContent = "All caught up! No submissions currently require grading.";
      } else if (statusFilter === "draft_grades") {
        elements.submissionsEmptyText.textContent = "No unreleased draft grades pending.";
      } else if (statusFilter === "pending_reevaluation") {
        elements.submissionsEmptyText.textContent = "No student re-evaluation requests are currently pending review.";
      } else {
        elements.submissionsEmptyText.textContent = isTeacher
          ? "No student work has been submitted yet for your assignments."
          : "You have not submitted work for any assignments yet.";
      }
    }
    return;
  }

  if (elements.submissionsEmptyState) elements.submissionsEmptyState.style.display = "none";

  const rows = list.map((s, idx) => {
    const statusPill = s.is_late
      ? `<span class="submission-pill status-late">Late</span>`
      : `<span class="submission-pill status-ontime">On-Time</span>`;
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
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(s.student_name)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(s.student_email)}</div>
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
      let reviewBadge = isReleased
        ? `<span class="submission-pill status-released">Released</span>`
        : `<span class="submission-pill status-ungraded">Pending Review</span>`;

      const resubAllowed = Boolean(s.resubmission_allowed);
      let isResubExpired = false;
      if (resubAllowed && s.resubmission_deadline) {
        isResubExpired = new Date(s.resubmission_deadline).getTime() < Date.now();
      }
      if (resubAllowed) {
        if (!isResubExpired) {
          reviewBadge += `<div style="margin-top: 0.25rem;"><span class="submission-pill status-resubmit-allowed" title="Resubmission permitted by teacher">↻ Resubmit Allowed</span></div>`;
        } else {
          reviewBadge += `<div style="margin-top: 0.25rem;"><span class="submission-pill status-resubmit-expired" title="Resubmission deadline passed">Resubmission Expired</span></div>`;
        }
      }

      const resubmitActionBtn = (resubAllowed && !isResubExpired)
        ? `<button class="btn btn-warning btn-xs submissions-resubmit-btn" data-index="${idx}" type="button" title="Resubmit revised attempt">Resubmit</button>`
        : "";

      const reevalActionBtn = isReleased
        ? `<button class="btn btn-outline-secondary btn-xs submissions-reeval-btn" data-index="${idx}" type="button" title="Request Grade Re-evaluation">Request Re-eval</button>`
        : "";

      const gradeHtml = isReleased
        ? `<strong style="color: var(--text-main); font-weight: 700;">${s.grade}</strong> / ${s.max_marks || 100} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${Math.round((s.grade / (s.max_marks || 100)) * 100)}%)</span>`
        : `<span style="color: var(--text-muted); font-size: 0.825rem;">Pending Review</span>`;

      return `
        <tr data-sub-id="${s.id}" data-assignment-id="${s.assignment_id}">
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
          <td class="col-sub-review-status">${reviewBadge}</td>
          <td class="col-sub-grade" style="font-size: 0.875rem;">${gradeHtml}</td>
          <td class="col-sub-actions" style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
              ${resubmitActionBtn}
              ${reevalActionBtn}
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
            state.currentGradingSubmissions = list;
            state.currentGradingIndex = idx;
            openGradingWorkspace(idx);
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
            state.currentGradingSubmissions = list;
            state.currentGradingIndex = idx;
            openGradingWorkspace(idx);
          }
        });
      });
    } else {
      // Student details, resubmit, and preview buttons
      const resubmitBtns = elements.submissionsTableBody.querySelectorAll(".submissions-resubmit-btn");
      resubmitBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            const subItem = list[idx];
            openSubmitWorkModal(
              { id: subItem.assignment_id, title: subItem.assignment_title, class_name: subItem.class_name },
              subItem
            );
          }
        });
      });

      const reevalBtns = elements.submissionsTableBody.querySelectorAll(".submissions-reeval-btn");
      reevalBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          if (!isNaN(idx) && list[idx]) {
            openStudentReevaluationModal(list[idx]);
          }
        });
      });

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

let calendarNavYear = new Date().getFullYear();
let calendarNavMonth = new Date().getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
let calendarSelectedDate = null; // Date object or null for all dates
let isCalendarNavWired = false;

/**
 * Initializes and wires Calendar navigation buttons once
 */
function wireCalendarControls() {
  if (isCalendarNavWired) return;
  isCalendarNavWired = true;

  if (elements.calendarPrevMonthBtn) {
    elements.calendarPrevMonthBtn.addEventListener("click", () => {
      calendarNavMonth--;
      if (calendarNavMonth < 0) {
        calendarNavMonth = 11;
        calendarNavYear--;
      }
      renderCalendarView();
    });
  }

  if (elements.calendarNextMonthBtn) {
    elements.calendarNextMonthBtn.addEventListener("click", () => {
      calendarNavMonth++;
      if (calendarNavMonth > 11) {
        calendarNavMonth = 0;
        calendarNavYear++;
      }
      renderCalendarView();
    });
  }

  if (elements.calendarTodayBtn) {
    elements.calendarTodayBtn.addEventListener("click", () => {
      const today = new Date();
      calendarNavYear = today.getFullYear();
      calendarNavMonth = today.getMonth();
      calendarSelectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      renderCalendarView();
    });
  }

  if (elements.calendarAllDatesBtn) {
    elements.calendarAllDatesBtn.addEventListener("click", () => {
      calendarSelectedDate = null;
      renderCalendarView();
    });
  }

  if (elements.calendarViewAssignmentsBtn) {
    elements.calendarViewAssignmentsBtn.addEventListener("click", () => {
      navigateToView("assignments", true);
    });
  }
}

/**
 * Renders the complete standalone Calendar page
 */
async function loadCalendarPageView() {
  wireCalendarControls();

  if (!state.assignments || !state.assignments.length) {
    await fetchAssignments();
  }

  renderCalendarView();
}

/**
 * Renders the calendar schedule grid and deadlines agenda
 */
function renderCalendarView() {
  if (!elements.calendarDeadlinesList && !elements.calendarMiniMonthContainer) return;

  const isStudent = state.currentUser && state.currentUser.role === "student";
  const isTeacher = state.currentUser && state.currentUser.role === "teacher";

  // Update Month & Year header display
  const monthDate = new Date(calendarNavYear, calendarNavMonth, 1);
  const monthName = monthDate.toLocaleDateString("en-US", { month: "long" });
  if (elements.calendarMonthYearDisplay) {
    elements.calendarMonthYearDisplay.textContent = `${monthName} ${calendarNavYear}`;
  }

  // Active status on Today vs All Deadlines buttons
  if (elements.calendarAllDatesBtn) {
    elements.calendarAllDatesBtn.classList.toggle("active", calendarSelectedDate === null);
  }
  if (elements.calendarTodayBtn) {
    const today = new Date();
    const isTodaySelected = calendarSelectedDate &&
      calendarSelectedDate.getFullYear() === today.getFullYear() &&
      calendarSelectedDate.getMonth() === today.getMonth() &&
      calendarSelectedDate.getDate() === today.getDate();
    elements.calendarTodayBtn.classList.toggle("active", Boolean(isTodaySelected));
  }

  // Filter assignments based on student draft privacy
  let allDueAssignments = [...(state.assignments || [])]
    .filter((a) => a.due_date);

  if (isStudent) {
    // Strictly filter out teacher drafts and unassigned assignments
    allDueAssignments = allDueAssignments.filter((a) => a.status !== "draft" && a.class_id);
  }

  allDueAssignments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Render Monthly Interactive Grid
  renderCalendarMonthGrid(allDueAssignments);

  // Filter Agenda items by selected date or month
  let agendaItems = allDueAssignments;
  if (calendarSelectedDate) {
    const selY = calendarSelectedDate.getFullYear();
    const selM = calendarSelectedDate.getMonth();
    const selD = calendarSelectedDate.getDate();
    agendaItems = allDueAssignments.filter((a) => {
      const d = new Date(a.due_date);
      return d.getFullYear() === selY && d.getMonth() === selM && d.getDate() === selD;
    });

    if (elements.calendarCurrentMonthLabel) {
      elements.calendarCurrentMonthLabel.textContent = calendarSelectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (elements.calendarAgendaSubtitle) {
      elements.calendarAgendaSubtitle.textContent = `Deadlines for ${calendarSelectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
    }
  } else {
    if (elements.calendarCurrentMonthLabel) {
      elements.calendarCurrentMonthLabel.textContent = "All Deadlines";
    }
    if (elements.calendarAgendaSubtitle) {
      elements.calendarAgendaSubtitle.textContent = "Sorted chronologically by due date";
    }
  }

  // Render Agenda List
  if (elements.calendarDeadlinesList) {
    if (!agendaItems.length) {
      const emptyMsg = calendarSelectedDate
        ? `No deadlines scheduled for ${calendarSelectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
        : "No upcoming assignment deadlines scheduled.";
      elements.calendarDeadlinesList.innerHTML = `
        <div class="dash-empty-state" style="padding: 2.5rem 1rem; text-align: center;">
          <p style="color: var(--text-muted); font-size: 0.9rem;">${emptyMsg}</p>
          ${calendarSelectedDate ? `<button class="btn btn-outline btn-sm" id="calendarResetToAllBtn" type="button" style="margin-top: 0.75rem;">View All Deadlines</button>` : ""}
        </div>
      `;
      const resetBtn = elements.calendarDeadlinesList.querySelector("#calendarResetToAllBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          calendarSelectedDate = null;
          renderCalendarView();
        });
      }
    } else {
      elements.calendarDeadlinesList.innerHTML = agendaItems.map((asgn) => {
        const badge = formatDateBadge(asgn.due_date);
        const days = calculateDaysRemaining(asgn.due_date);
        const chipClass = days < 0 ? "days-left-chip" : (days <= 2 ? "days-left-chip warning" : "days-left-chip muted");
        const daysText = days < 0 ? "Overdue" : (days === 0 ? "Due Today" : `${days} days left`);

        const effectiveStatus = getEffectiveStatus(asgn);
        let statusBadge = "";
        if (isStudent) {
          const mySub = state.mySubmissions ? state.mySubmissions[asgn.id] : null;
          if (effectiveStatus === "resubmit") {
            statusBadge = `<span class="submission-pill status-resubmit-allowed">↻ Resubmit</span>`;
          } else if (effectiveStatus === "graded") {
            const score = mySub && mySub.grade !== null && mySub.grade !== undefined ? mySub.grade : "—";
            statusBadge = `<span class="submission-pill status-released">Score: ${score}/${asgn.max_marks || 100}</span>`;
          } else if (effectiveStatus === "submitted") {
            statusBadge = `<span class="submission-pill status-ontime">✓ Submitted</span>`;
          } else if (effectiveStatus === "overdue") {
            statusBadge = `<span class="status-pill status-overdue">Missing</span>`;
          } else {
            statusBadge = `<span class="${chipClass}">${daysText}</span>`;
          }
        } else if (isTeacher) {
          const subCount = asgn.submission_count !== undefined ? asgn.submission_count : 0;
          const tot = asgn.total_students || 0;
          statusBadge = `<span class="submission-progress-chip" style="margin: 0; font-weight: 600;">${subCount}/${tot} submitted</span>`;
        } else {
          statusBadge = `<span class="${chipClass}">${daysText}</span>`;
        }

        return `
          <div class="calendar-item" data-asgn-id="${asgn.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(asgn.title)} details">
            <div class="dash-item-main">
              <div class="dash-date-badge">
                <span class="dash-date-month">${badge.month}</span>
                <span class="dash-date-day">${badge.day}</span>
              </div>
              <div class="dash-item-texts">
                <span class="dash-item-title" style="font-weight: 600;">${escapeHtml(asgn.title)}</span>
                <span class="dash-item-sub">${escapeHtml(asgn.class_name || asgn.subject || "General")} • Unit ${asgn.unit || 1}</span>
              </div>
            </div>
            <div class="dash-item-meta" style="display: flex; align-items: center; gap: 0.5rem;">
              ${statusBadge}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        `;
      }).join("");

      // Clicking an agenda item opens the correct detail or submission workflow directly
      elements.calendarDeadlinesList.querySelectorAll(".calendar-item").forEach((item) => {
        item.addEventListener("click", () => {
          const asgnId = parseInt(item.getAttribute("data-asgn-id"), 10);
          const asgn = (state.assignments || []).find((a) => a.id === asgnId);
          if (!asgn) return;

          if (isStudent) {
            const mySub = state.mySubmissions ? state.mySubmissions[asgn.id] : null;
            if (mySub) {
              openViewSubmissionModal(asgn, mySub);
            } else {
              openSubmitWorkModal(asgn);
            }
          } else if (isTeacher) {
            openTeacherSubmissionsModal(asgn);
          } else {
            navigateToView("assignments", true);
          }
        });
      });
    }
  }
}

/**
 * Builds the interactive monthly table grid for the current navigated month/year
 */
function renderCalendarMonthGrid(assignments) {
  if (!elements.calendarMiniMonthContainer) return;

  const year = calendarNavYear;
  const month = calendarNavMonth;
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Map deadlines in this month by date number -> count
  const deadlineDays = new Map();
  assignments.forEach((a) => {
    if (!a.due_date) return;
    const d = new Date(a.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayNum = d.getDate();
      deadlineDays.set(dayNum, (deadlineDays.get(dayNum) || 0) + 1);
    }
  });

  let html = `
    <table class="calendar-mini-table" role="grid" aria-label="Course schedule for ${new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}">
      <thead>
        <tr>
          <th scope="col">Su</th>
          <th scope="col">Mo</th>
          <th scope="col">Tu</th>
          <th scope="col">We</th>
          <th scope="col">Th</th>
          <th scope="col">Fr</th>
          <th scope="col">Sa</th>
        </tr>
      </thead>
      <tbody><tr>
  `;

  for (let i = 0; i < firstDayIndex; i++) {
    html += `<td class="empty-cell" aria-hidden="true"></td>`;
  }

  let currentDay = 1;
  let dayOfWeek = firstDayIndex;

  while (currentDay <= lastDay) {
    if (dayOfWeek === 7) {
      html += `</tr><tr>`;
      dayOfWeek = 0;
    }

    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === currentDay;
    const hasDeadline = deadlineDays.has(currentDay);
    const deadlineCount = deadlineDays.get(currentDay) || 0;
    const isSelected = calendarSelectedDate &&
      calendarSelectedDate.getFullYear() === year &&
      calendarSelectedDate.getMonth() === month &&
      calendarSelectedDate.getDate() === currentDay;

    let classes = ["day-cell"];
    if (isToday) classes.push("today");
    if (hasDeadline) classes.push("has-deadline");
    if (isSelected) classes.push("selected-date");

    const dlTitle = hasDeadline ? `${deadlineCount} assignment deadline${deadlineCount > 1 ? 's' : ''}` : '';
    const dateLabel = `${new Date(year, month, currentDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${dlTitle ? ': ' + dlTitle : ''}`;

    html += `
      <td class="${classes.join(' ')}" data-day="${currentDay}" role="gridcell" tabindex="0" aria-label="${escapeHtml(dateLabel)}" title="${escapeHtml(dlTitle)}">
        ${currentDay}
      </td>
    `;

    currentDay++;
    dayOfWeek++;
  }

  while (dayOfWeek < 7) {
    html += `<td class="empty-cell" aria-hidden="true"></td>`;
    dayOfWeek++;
  }

  html += `</tr></tbody></table>`;

  elements.calendarMiniMonthContainer.innerHTML = html;

  // Day cell click events for date selection
  elements.calendarMiniMonthContainer.querySelectorAll(".day-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const dayNum = parseInt(cell.getAttribute("data-day"), 10);
      if (!isNaN(dayNum)) {
        if (calendarSelectedDate &&
            calendarSelectedDate.getFullYear() === year &&
            calendarSelectedDate.getMonth() === month &&
            calendarSelectedDate.getDate() === dayNum) {
          // Toggle off if clicking the already-selected date
          calendarSelectedDate = null;
        } else {
          calendarSelectedDate = new Date(year, month, dayNum);
        }
        renderCalendarView();
      }
    });

    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        cell.click();
      }
    });
  });
}

function calculateDaysRemaining(dateStr) {
  if (!dateStr) return 0;
  const now = new Date();
  const due = new Date(dateStr);
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Renders the standalone Analytics & Academic Performance page
 */
async function loadAnalyticsPageView() {
  const epoch = state.authEpoch;

  if (!state.currentUser) {
    if (elements.analyticsKpiRow) elements.analyticsKpiRow.innerHTML = "";
    if (elements.analyticsRankingsBody) {
      elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Please sign in to view academic analytics and performance insights.</td></tr>`;
    }
    openAuthModal("signin", "Please sign in to access analytics.");
    return;
  }

  const isTeacher = state.currentUser.role === "teacher";
  if (elements.analyticsPageTitle) {
    elements.analyticsPageTitle.textContent = isTeacher ? "Analytics & Results" : "Results & Academic Progress";
  }
  if (elements.analyticsPageSubtitle) {
    elements.analyticsPageSubtitle.textContent = isTeacher
      ? "Detailed academic insights, unit-wise rankings, and finalized performance metrics."
      : "Personal assignment feedback, unit performance, and privacy-safe class standing.";
  }

  // Ensure classes and assignments are loaded
  if (!state.classes || state.classes.length === 0) {
    await fetchClasses();
  }
  if (epoch !== state.authEpoch) return;

  if (!state.assignments || state.assignments.length === 0) {
    try {
      const asgnRes = await fetch(API_ENDPOINTS.assignments, {
        method: "GET",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        signal: state.activeAbortController?.signal,
      });
      if (asgnRes.ok) {
        state.assignments = await asgnRes.json();
      }
    } catch (_) {}
  }
  if (epoch !== state.authEpoch) return;

  const classes = state.classes || [];

  // Populate Class Select Dropdown
  if (elements.analyticsClassSelect) {
    if (classes.length === 0) {
      elements.analyticsClassSelect.innerHTML = '<option value="">No Classes Available</option>';
      currentAnalyticsClassId = null;
      currentAnalyticsSubject = "";
      if (elements.analyticsSubjectSelect) {
        elements.analyticsSubjectSelect.innerHTML = '<option value="">All Subjects</option>';
      }
      renderAnalyticsEmptyState(isTeacher ? "No classes found. Please create a class first." : "You are not enrolled in any classes yet.");
      return;
    }

    // Retain selected class if still valid in user's classes, otherwise default to first class
    const isCurrentValid = currentAnalyticsClassId && classes.some(c => c.id === currentAnalyticsClassId);
    if (!isCurrentValid) {
      currentAnalyticsClassId = classes[0].id;
    }

    elements.analyticsClassSelect.innerHTML = '<option value="">Select Class...</option>' +
      classes.map(c => `<option value="${c.id}" ${c.id === currentAnalyticsClassId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
  }

  // Populate Subjects for the selected class
  await populateAnalyticsSubjectSelect(currentAnalyticsClassId);
  if (epoch !== state.authEpoch) return;

  // Fetch and display analytics data
  await refreshAnalyticsData();
}

/**
 * Populates the subject dropdown with subjects belonging strictly to the selected class
 */
async function populateAnalyticsSubjectSelect(classId) {
  if (!elements.analyticsSubjectSelect) return;
  if (!classId) {
    elements.analyticsSubjectSelect.innerHTML = '<option value="">All Subjects</option>';
    currentAnalyticsSubject = "";
    return;
  }

  const epoch = state.authEpoch;
  const subjectSet = new Set();

  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}/subjects`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
    if (res.ok) {
      const subs = await res.json();
      (subs || []).forEach((s) => {
        if (s.name && s.name.trim()) subjectSet.add(s.name.trim());
      });
    }
  } catch (_) {}

  // Also include distinct subjects from assignments belonging to this class
  (state.assignments || []).forEach((a) => {
    if (a.class_id == classId && a.subject && a.subject.trim()) {
      subjectSet.add(a.subject.trim());
    }
  });

  const subjects = Array.from(subjectSet).sort();

  // Validate current subject selection
  if (currentAnalyticsSubject && !subjectSet.has(currentAnalyticsSubject)) {
    currentAnalyticsSubject = "";
  }
  // Auto-select if there is exactly 1 subject in this class
  if (!currentAnalyticsSubject && subjects.length === 1) {
    currentAnalyticsSubject = subjects[0];
  }

  let html = '<option value="">All Subjects</option>';
  subjects.forEach((s) => {
    html += `<option value="${escapeHtml(s)}" ${s === currentAnalyticsSubject ? "selected" : ""}>${escapeHtml(s)}</option>`;
  });
  elements.analyticsSubjectSelect.innerHTML = html;
}

/**
 * Change handler for Class select dropdown
 */
async function handleAnalyticsClassChange(e) {
  const val = e.target.value;
  currentAnalyticsClassId = val ? parseInt(val, 10) : null;
  currentAnalyticsSubject = "";
  if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";

  if (!currentAnalyticsClassId) {
    if (elements.analyticsSubjectSelect) {
      elements.analyticsSubjectSelect.innerHTML = '<option value="">All Subjects</option>';
    }
    renderAnalyticsEmptyState("Select a class to view academic analytics and performance insights.");
    return;
  }

  await populateAnalyticsSubjectSelect(currentAnalyticsClassId);
  await refreshAnalyticsData();
}

/**
 * Change handler for Subject select dropdown
 */
async function handleAnalyticsSubjectChange(e) {
  currentAnalyticsSubject = e.target.value ? e.target.value.trim() : "";
  if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";
  await refreshAnalyticsData();
}

/**
 * Primary data fetcher for Analytics View
 */
async function refreshAnalyticsData() {
  const epoch = state.authEpoch;
  const classId = currentAnalyticsClassId;
  const subject = currentAnalyticsSubject;

  if (!classId) {
    renderAnalyticsEmptyState("Select a class to view academic analytics and performance insights.");
    return;
  }

  const isTeacher = state.currentUser?.role === "teacher";

  // Action Buttons visibility
  if (elements.btnExportSummaryCsv) {
    elements.btnExportSummaryCsv.style.display = isTeacher ? "inline-flex" : "none";
  }
  if (elements.btnExportDetailedCsv) {
    elements.btnExportDetailedCsv.style.display = (isTeacher && subject) ? "inline-flex" : "none";
  }
  if (elements.btnFinalizeResults) {
    elements.btnFinalizeResults.style.display = (isTeacher && subject) ? "inline-flex" : "none";
  }
  if (elements.btnToggleLeaderboard) {
    elements.btnToggleLeaderboard.style.display = subject ? "inline-flex" : "none";
  }

  showAnalyticsLoadingState();

  try {
    // 1. Fetch Class Overview
    const overviewUrl = API_ENDPOINTS.analytics.overview(classId, subject || undefined);
    const overviewRes = await fetch(overviewUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

    if (!overviewRes.ok) {
      if (overviewRes.status === 403) {
        showAnalyticsError("Access denied: You are not authorized to view analytics for this class.");
        return;
      }
      showAnalyticsError("Unable to load class analytics at this time.");
      return;
    }

    const overviewData = await overviewRes.json();
    state.analyticsOverviewData = overviewData;
    renderAnalyticsOverview(overviewData);

    // 2. Role-specific: Teacher Alerts vs Student Feedback
    if (isTeacher) {
      if (elements.analyticsStudentFeedbackCard) {
        elements.analyticsStudentFeedbackCard.style.display = "none";
      }
      try {
        const alertsUrl = API_ENDPOINTS.analytics.alerts(classId, subject || undefined);
        const alertsRes = await fetch(alertsUrl, {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: state.activeAbortController?.signal,
        });
        if (epoch === state.authEpoch && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          renderTeacherAlerts(alertsData);
        } else {
          if (elements.analyticsAlertsContainer) elements.analyticsAlertsContainer.style.display = "none";
        }
      } catch (_) {
        if (elements.analyticsAlertsContainer) elements.analyticsAlertsContainer.style.display = "none";
      }
    } else {
      // Student: hide teacher alerts, fetch private feedback
      if (elements.analyticsAlertsContainer) {
        elements.analyticsAlertsContainer.style.display = "none";
      }
      if (elements.analyticsStudentFeedbackCard) {
        elements.analyticsStudentFeedbackCard.style.display = "block";
      }
      try {
        const feedbackUrl = API_ENDPOINTS.analytics.feedback(classId, subject || undefined);
        const feedbackRes = await fetch(feedbackUrl, {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: state.activeAbortController?.signal,
        });
        if (epoch === state.authEpoch) {
          if (feedbackRes.ok) {
            const feedbackData = await feedbackRes.json();
            renderStudentFeedback(feedbackData);
          } else {
            renderStudentFeedback([]);
          }
        }
      } catch (_) {
        renderStudentFeedback([]);
      }
    }

    // 3. Rankings (requires a subject)
    if (subject) {
      const rankingsUrl = API_ENDPOINTS.analytics.rankings(classId, subject);
      const rankingsRes = await fetch(rankingsUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: state.activeAbortController?.signal,
      });
      if (epoch !== state.authEpoch) return;

      if (rankingsRes.ok) {
        const rankingsData = await rankingsRes.json();
        state.analyticsRankingsData = rankingsData;
        renderAnalyticsRankings(rankingsData);
      } else {
        if (elements.analyticsRankingsBody) {
          elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load rankings for ${escapeHtml(subject)}.</td></tr>`;
        }
      }
    } else {
      // "All Subjects" selected: prompt user to pick a subject for rankings
      if (elements.analyticsFinalizedBadge) elements.analyticsFinalizedBadge.style.display = "none";
      if (elements.analyticsRankingsHead) {
        elements.analyticsRankingsHead.innerHTML = `
          <th>Rank</th>
          <th>Student</th>
          <th>Provisional %</th>
          <th>Final %</th>
          <th>Status</th>
        `;
      }
      if (elements.analyticsRankingsBody) {
        elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Select a specific subject above to view unit-by-unit rankings, provisional percentages, and finalized results.</td></tr>`;
      }
    }
  } catch (err) {
    if (epoch !== state.authEpoch) return;
    console.error("Analytics fetch error:", err);
    showAnalyticsError("Network error: Failed to fetch analytics data.");
  }
}

/**
 * Display loading spinner state across analytics panels
 */
function showAnalyticsLoadingState() {
  if (elements.analyticsKpiRow) {
    elements.analyticsKpiRow.innerHTML = `
      <div style="padding: 1.5rem; width: 100%; text-align: center; color: var(--text-muted);">
        <span class="spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span>
        <span>Loading academic metrics...</span>
      </div>
    `;
  }
  if (elements.analyticsRankingsBody) {
    elements.analyticsRankingsBody.innerHTML = `
      <tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <span class="spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span>
        <span>Loading performance rankings...</span>
      </td></tr>
    `;
  }
  if (elements.analyticsUnitComparisonsBody) {
    elements.analyticsUnitComparisonsBody.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
        <span class="spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span>
        <span>Loading unit comparisons...</span>
      </div>
    `;
  }
  if (elements.analyticsRightCardBody) {
    elements.analyticsRightCardBody.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
        <span class="spinner" style="display:inline-block; margin-right:8px; vertical-align:middle;"></span>
        <span>Loading distribution...</span>
      </div>
    `;
  }
}

/**
 * Empty state renderer when no classes or data are available
 */
function renderAnalyticsEmptyState(message) {
  if (elements.analyticsKpiRow) {
    elements.analyticsKpiRow.innerHTML = `
      <div class="dash-empty-state" style="padding: 2.5rem 1rem; width: 100%; text-align: center;">
        <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">${escapeHtml(message)}</p>
      </div>
    `;
  }
  if (elements.analyticsRankingsBody) {
    elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">${escapeHtml(message)}</td></tr>`;
  }
  if (elements.analyticsUnitComparisonsBody) {
    elements.analyticsUnitComparisonsBody.innerHTML = `<div class="dash-empty-state"><p>${escapeHtml(message)}</p></div>`;
  }
  if (elements.analyticsRightCardBody) {
    elements.analyticsRightCardBody.innerHTML = `<div class="dash-empty-state"><p>${escapeHtml(message)}</p></div>`;
  }
  if (elements.btnExportSummaryCsv) elements.btnExportSummaryCsv.style.display = "none";
  if (elements.btnExportDetailedCsv) elements.btnExportDetailedCsv.style.display = "none";
  if (elements.btnFinalizeResults) elements.btnFinalizeResults.style.display = "none";
  if (elements.btnToggleLeaderboard) elements.btnToggleLeaderboard.style.display = "none";
  if (elements.analyticsAlertsContainer) elements.analyticsAlertsContainer.style.display = "none";
  if (elements.analyticsStudentFeedbackCard) elements.analyticsStudentFeedbackCard.style.display = "none";
  if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";
}

/**
 * Error state renderer for failed network requests or unauthorized responses
 */
function showAnalyticsError(message) {
  if (elements.analyticsKpiRow) {
    elements.analyticsKpiRow.innerHTML = `
      <div class="analytics-error-banner">
        <p style="margin: 0; font-weight: 500;">${escapeHtml(message)}</p>
      </div>
    `;
  }
  if (elements.analyticsRankingsBody) {
    elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger);">${escapeHtml(message)}</td></tr>`;
  }
  if (elements.analyticsUnitComparisonsBody) {
    elements.analyticsUnitComparisonsBody.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--danger);"><p>${escapeHtml(message)}</p></div>`;
  }
  if (elements.analyticsRightCardBody) {
    elements.analyticsRightCardBody.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--danger);"><p>${escapeHtml(message)}</p></div>`;
  }
  if (elements.btnExportSummaryCsv) elements.btnExportSummaryCsv.style.display = "none";
  if (elements.btnExportDetailedCsv) elements.btnExportDetailedCsv.style.display = "none";
  if (elements.btnFinalizeResults) elements.btnFinalizeResults.style.display = "none";
  if (elements.btnToggleLeaderboard) elements.btnToggleLeaderboard.style.display = "none";
  if (elements.analyticsAlertsContainer) elements.analyticsAlertsContainer.style.display = "none";
  if (elements.analyticsStudentFeedbackCard) elements.analyticsStudentFeedbackCard.style.display = "none";
  if (elements.analyticsLeaderboardCard) elements.analyticsLeaderboardCard.style.display = "none";
}

/**
 * Renders individual student assessment feedback notes and grades (Student only)
 */
function renderStudentFeedback(items) {
  if (!elements.analyticsStudentFeedbackBody) return;
  if (!items || items.length === 0) {
    elements.analyticsStudentFeedbackBody.innerHTML = `
      <div class="dash-empty-state" style="padding: 1.5rem; text-align: center;">
        <p>No assessment feedback recorded yet for this class.</p>
      </div>
    `;
    return;
  }

  const html = `
    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
      ${items.map((item) => {
        const hasScore = item.grade !== null && item.grade !== undefined;
        const scoreStr = hasScore ? `${item.grade} / ${item.max_marks}` : "Ungraded / Pending";
        const pct = hasScore && item.max_marks > 0 ? Math.round((item.grade / item.max_marks) * 100) + "%" : "";
        const isReleased = item.status === "released";
        const statusBadge = isReleased
          ? '<span class="submission-pill status-graded" style="font-size:0.75rem;">Released</span>'
          : '<span class="submission-pill status-draft" style="font-size:0.75rem;">Submitted</span>';
        const lateBadge = item.is_late
          ? '<span class="submission-pill status-late" style="font-size:0.75rem; margin-left: 0.5rem;">Late</span>'
          : "";

        return `
          <div class="analytics-feedback-item">
            <div class="analytics-feedback-header">
              <div>
                <span class="analytics-feedback-title">Unit ${item.unit}: ${escapeHtml(item.assignment_title)}</span>
                <div style="margin-top: 0.35rem;">
                  ${statusBadge}
                  ${lateBadge}
                </div>
              </div>
              <div style="text-align: right;">
                <span class="analytics-feedback-score">${scoreStr}</span>
                ${pct ? `<div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">${pct}</div>` : ""}
              </div>
            </div>
            ${item.feedback ? `
              <div class="analytics-feedback-notes">
                <strong style="color: var(--text-main); font-size: 0.8rem; display: block; margin-bottom: 0.2rem;">Instructor Feedback:</strong>
                <p style="margin: 0; line-height: 1.5;">${escapeHtml(item.feedback)}</p>
              </div>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
  elements.analyticsStudentFeedbackBody.innerHTML = html;
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

  fetchNotificationPreferences();
}

/**
 * Loads notification preferences from backend API
 */
async function fetchNotificationPreferences() {
  if (!state.currentUser) return;
  try {
    const res = await fetch(`${API_ENDPOINTS.notifications}/preferences`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (!res.ok) return;
    const prefs = await res.json();
    if (elements.prefInAppEnabled) elements.prefInAppEnabled.checked = Boolean(prefs.in_app_enabled);
    if (elements.prefEmailEnabled) elements.prefEmailEnabled.checked = Boolean(prefs.email_enabled);
    if (elements.prefEmailGradeReleased) elements.prefEmailGradeReleased.checked = Boolean(prefs.email_on_grade_released);
    if (elements.prefEmailDeadline) elements.prefEmailDeadline.checked = Boolean(prefs.email_on_deadline);
    if (elements.prefEmailReevaluation) elements.prefEmailReevaluation.checked = Boolean(prefs.email_on_reevaluation);
  } catch (err) {
    console.error("Failed to load notification preferences:", err);
  }
}

async function saveSettingsPreferences() {
  if (elements.settingsDefaultSort) {
    const sortVal = elements.settingsDefaultSort.value;
    localStorage.setItem("assignflow_sort_pref", sortVal);
    state.filters.sort = sortVal;
    if (elements.sortFilter) elements.sortFilter.value = sortVal;
  }
  if (elements.settingsReminderToggle) {
    localStorage.setItem("assignflow_reminder_pref", String(elements.settingsReminderToggle.checked));
  }

  const payload = {
    in_app_enabled: elements.prefInAppEnabled ? elements.prefInAppEnabled.checked : true,
    email_enabled: elements.prefEmailEnabled ? elements.prefEmailEnabled.checked : false,
    email_on_grade_released: elements.prefEmailGradeReleased ? elements.prefEmailGradeReleased.checked : true,
    email_on_deadline: elements.prefEmailDeadline ? elements.prefEmailDeadline.checked : true,
    email_on_reevaluation: elements.prefEmailReevaluation ? elements.prefEmailReevaluation.checked : true,
  };

  const saveBtn = elements.settingsSavePreferencesBtn;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const res = await fetch(`${API_ENDPOINTS.notifications}/preferences`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const updated = await res.json();
      if (elements.prefInAppEnabled) elements.prefInAppEnabled.checked = Boolean(updated.in_app_enabled);
      if (elements.prefEmailEnabled) elements.prefEmailEnabled.checked = Boolean(updated.email_enabled);
      if (elements.prefEmailGradeReleased) elements.prefEmailGradeReleased.checked = Boolean(updated.email_on_grade_released);
      if (elements.prefEmailDeadline) elements.prefEmailDeadline.checked = Boolean(updated.email_on_deadline);
      if (elements.prefEmailReevaluation) elements.prefEmailReevaluation.checked = Boolean(updated.email_on_reevaluation);
      showToast("Preferences saved successfully!", "success");
      fetchNotifications();
    } else {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.detail || "Failed to save notification preferences.", "error");
    }
  } catch (err) {
    console.error("Save preferences error:", err);
    showToast("Failed to connect to backend.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Preferences";
    }
  }
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
  const epoch = state.authEpoch;
  try {
    const res = await fetch(API_ENDPOINTS.semesters, {
      method: "GET",
      credentials: "same-origin",
      headers: getAuthHeaders(),
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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
  const epoch = state.authEpoch;
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
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning," : (hour < 18 ? "Good afternoon," : "Good evening,");
  if (elements.dashGreeting) elements.dashGreeting.textContent = timeGreeting;
  if (elements.dashUserName) elements.dashUserName.textContent = state.currentUser?.full_name || "Teacher";
  if (elements.dashSubtitle) elements.dashSubtitle.textContent = `Here's an overview of your semester (${escapeHtml(sem.name)}).`;

  const teacherRole = state.currentUser?.role || "teacher";
  if (elements.dashRolePill) {
    elements.dashRolePill.style.display = "inline-flex";
    elements.dashRolePill.className = `dash-role-pill ${teacherRole}`;
  }
  if (elements.dashRolePillText) {
    elements.dashRolePillText.textContent = capitalize(teacherRole);
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
        <div class="dash-metric-icon icon-blue">
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
        <div class="dash-metric-icon icon-green">
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
        <div class="dash-metric-icon icon-purple">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="9" stroke="var(--border-subtle)"/>
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

          <div class="dark-quick-action-item" onclick="navigateToView('analytics')">
            <div class="dark-qa-left">
              <div class="dark-qa-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
              </div>
              <div class="dark-qa-texts">
                <span class="dark-qa-title">View Analytics</span>
                <span class="dark-qa-desc">Class performance & insights</span>
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

  // 4B. Center Column: Grading Queue (Authoritative pending work)
  const realQueue = dashData.grading_queue || [];
  let queueHtml = "";
  if (realQueue.length > 0) {
    queueHtml = realQueue.slice(0, 5).map((item) => {
      const isReeval = Boolean(item.needs_reevaluation);
      const badgeClass = isReeval ? "dash-queue-pill warning" : "dash-queue-pill";
      const badgeText = isReeval ? "Re-eval Request" : (item.is_late ? "Late (Ungraded)" : "Needs Grading");
      return `
        <div class="dash-queue-item" data-sub-id="${item.id}" data-asgn-id="${item.assignment_id}" style="cursor: pointer;">
          <div class="dash-queue-left">
            <div class="dash-queue-icon" style="background: rgba(40, 87, 71, 0.1); color: var(--primary);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="dash-queue-texts">
              <span class="dash-queue-title">${escapeHtml(item.student_name)} • ${escapeHtml(item.assignment_title)}</span>
              <span class="dash-queue-sub">${escapeHtml(item.class_name || "Coursework")} • ${formatDisplayDate(item.submitted_at)}</span>
            </div>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
          <div class="dash-metric-chevron" style="width: 28px; height: 28px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `;
    }).join("");
  } else {
    queueHtml = '<div class="dash-empty-state"><p>All caught up! No pending submissions needing grading.</p></div>';
  }

  if (elements.dashBottomCenterCard) {
    elements.dashBottomCenterCard.innerHTML = `
      <div class="dash-card-header">
        <h2 class="dash-card-title">Grading Queue ${realQueue.length ? `(${realQueue.length})` : ""}</h2>
        <button class="dash-card-link" onclick="navigateToView('submissions')">View all</button>
      </div>
      <div class="dash-queue-list">
        ${queueHtml}
      </div>
    `;

    // Direct SpeedGrader workspace opening from Dashboard Grading Queue
    elements.dashBottomCenterCard.querySelectorAll(".dash-queue-item").forEach((qEl) => {
      qEl.addEventListener("click", () => {
        const subId = parseInt(qEl.getAttribute("data-sub-id"), 10);
        const item = realQueue.find((q) => q.id === subId);
        if (item) {
          state.currentGradingAssignment = {
            id: item.assignment_id,
            title: item.assignment_title,
            class_name: item.class_name,
            max_marks: 100,
          };
          state.currentGradingSubmissions = realQueue;
          const foundIdx = realQueue.findIndex((q) => q.id === subId);
          state.currentGradingIndex = foundIdx >= 0 ? foundIdx : 0;
          openGradingWorkspace(state.currentGradingIndex);
        }
      });
    });
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
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning," : (hour < 18 ? "Good afternoon," : "Good evening,");
  if (elements.dashGreeting) elements.dashGreeting.textContent = timeGreeting;
  const realName = data.user.full_name || state.currentUser?.full_name || (isTeacher ? "Teacher" : "Student");
  if (elements.dashUserName) elements.dashUserName.textContent = realName;

  if (elements.dashRolePill) {
    elements.dashRolePill.style.display = "inline-flex";
    elements.dashRolePill.className = `dash-role-pill ${data.role || "student"}`;
  }
  if (elements.dashRolePillText) {
    elements.dashRolePillText.textContent = capitalize(data.role || "student");
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
          <div class="dash-metric-icon icon-amber">
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
        <div class="dash-metric-card" onclick="navigateToView('assignments')" style="cursor: pointer;" title="View all assignments">
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
        <div class="dash-metric-card" onclick="navigateToView('assignments')" style="cursor: pointer;" title="View pending assignments">
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
        <div class="dash-metric-card" onclick="navigateToView('submissions')" style="cursor: pointer;" title="View your submissions">
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
        <div class="dash-metric-card" onclick="navigateToView('assignments')" style="cursor: pointer;" title="View overdue assignments">
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
    // Student Middle Row: 3 Columns
    // 1. Left Column: Upcoming Deadlines
    const upcomingList = (data.upcoming_assignments || []).map((asgn) => {
      const formattedDate = formatDisplayDate(asgn.due_date);
      let chipClass = "days-left-chip muted";
      let chipText = `${asgn.days_left} days left`;
      if (asgn.days_left < 0) {
        chipClass = "days-left-chip overdue";
        chipText = "Overdue";
      } else if (asgn.days_left === 0) {
        chipClass = "days-left-chip warning due-soon";
        chipText = "Due Today";
      } else if (asgn.days_left <= 2) {
        chipClass = "days-left-chip warning due-soon";
        chipText = "Due Soon";
      }

      return `
        <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('assignments')">
          <div class="dash-item-main">
            <div class="dash-icon-box sage">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <span class="${chipClass}">${chipText}</span>
            </div>
            <svg class="dash-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join("");

    elements.dashMidLeftCard.className = "dash-box-card student-dash-card";
    elements.dashMidLeftCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line>
          </svg>
          <h2 class="dash-card-title">Upcoming Deadlines</h2>
        </div>
        <button class="dash-card-link" id="linkStudentUpcomingViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${upcomingList || '<div class="dash-empty-state"><p>No upcoming assignments.</p></div>'}
      </div>
    `;

    document.getElementById("linkStudentUpcomingViewAll")?.addEventListener("click", () => {
      navigateToView("assignments");
    });

    // 2. Center Column: My Classes
    const enrolledMidClassesList = (data.my_classes || []).map((cls) => `
      <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('classes')">
        <div class="dash-item-main">
          <div class="dash-icon-box soft-sage">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
              <path d="M6 6h10"></path>
              <path d="M6 10h10"></path>
            </svg>
          </div>
          <div class="dash-item-texts">
            <span class="dash-item-title">${escapeHtml(cls.name)}</span>
            <span class="dash-item-sub">${escapeHtml(cls.teacher_name)} &bull; ${escapeHtml(cls.description)}</span>
          </div>
        </div>
        <div class="dash-item-meta">
          <svg class="dash-item-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    `).join("");

    elements.dashMidCenterCard.className = "dash-box-card student-dash-card";
    elements.dashMidCenterCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h2 class="dash-card-title">My Classes</h2>
        </div>
        <button class="dash-card-link" id="linkStudentMidClassesManage">Manage &rarr;</button>
      </div>
      <div class="dash-list">
        ${enrolledMidClassesList || '<div class="dash-empty-state"><p>Not enrolled in any classes yet.</p><button class="btn btn-secondary btn-sm" onclick="openClassesModal()">+ Join Class</button></div>'}
      </div>
    `;

    document.getElementById("linkStudentMidClassesManage")?.addEventListener("click", () => {
      navigateToView("classes");
    });

    // 3. Right Column: Mini Calendar & Quick Actions
    elements.dashMidRightCard.className = "dash-box-card student-dash-card student-calendar-card";
    const nowCal = new Date();
    const curYear = nowCal.getFullYear();
    const curMonth = nowCal.getMonth();
    const monthYearLabel = nowCal.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstDayIndex = new Date(curYear, curMonth, 1).getDay();
    const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
    const today = nowCal.getDate();

    const deadlineDays = new Set();
    (data.upcoming_assignments || []).forEach((a) => {
      if (!a.due_date) return;
      const d = new Date(a.due_date);
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        deadlineDays.add(d.getDate());
      }
    });

    let calRowsHtml = "<tr>";
    for (let i = 0; i < firstDayIndex; i++) {
      calRowsHtml += "<td></td>";
    }
    let currentDay = 1;
    let dayOfWeek = firstDayIndex;
    while (currentDay <= lastDay) {
      if (dayOfWeek === 7) {
        calRowsHtml += "</tr><tr>";
        dayOfWeek = 0;
      }
      const isToday = currentDay === today;
      const hasDeadline = deadlineDays.has(currentDay);
      let dayClasses = [];
      if (isToday) dayClasses.push("today");
      if (hasDeadline) dayClasses.push("has-deadline");
      calRowsHtml += `<td class="${dayClasses.join(" ")}" title="${hasDeadline ? 'Assignment deadline on this date' : ''}">${currentDay}</td>`;
      currentDay++;
      dayOfWeek++;
    }
    while (dayOfWeek < 7) {
      calRowsHtml += "<td></td>";
      dayOfWeek++;
    }
    calRowsHtml += "</tr>";

    elements.dashMidRightCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(monthYearLabel)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Academic Schedule</span>
        </div>
      </div>
      <div class="student-calendar-wrap">
        <table class="student-dash-cal-table">
          <thead>
            <tr><th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th></tr>
          </thead>
          <tbody>
            ${calRowsHtml}
          </tbody>
        </table>
      </div>
      <div class="student-dash-quick-actions">
        <div class="student-qa-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span>Quick Actions</span>
        </div>
        <div class="student-qa-buttons">
          <button class="btn btn-primary btn-sm" id="btnStudentDashJoinClass" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Join Class</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btnStudentDashSubmissions" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span>View Submissions</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btnStudentDashResults" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>Academic Results</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById("btnStudentDashJoinClass")?.addEventListener("click", () => openClassesModal());
    document.getElementById("btnStudentDashSubmissions")?.addEventListener("click", () => navigateToView("submissions"));
    document.getElementById("btnStudentDashResults")?.addEventListener("click", () => navigateToView("analytics"));
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
    document.getElementById("qaTileViewAnalytics")?.addEventListener("click", () => navigateToView("analytics"));

  } else {
    // Student Bottom Row: 3 Columns
    // 1. Left Column: Submission Overview Donut
    elements.dashBottomLeftCard.className = "dash-box-card student-dash-card";
    elements.dashBottomLeftCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
          <h2 class="dash-card-title">Submission Overview</h2>
        </div>
      </div>
      <div id="studentDonutContainer"></div>
    `;
    const statusObj = data.submission_status || { pending: 0, submitted: 0, overdue: 0, total: 0 };
    if (statusObj.released !== undefined && statusObj.pending_review !== undefined) {
      renderDonutChart("studentDonutContainer", statusObj.total, "Total", [
        { label: "Pending", value: statusObj.pending, color: "#F6E5B8" },
        { label: "Pending Review", value: statusObj.pending_review, color: "#E09F3E" },
        { label: "Released", value: statusObj.released, color: "#285747" },
        { label: "Overdue", value: statusObj.overdue, color: "#B42318" },
      ]);
    } else {
      renderDonutChart("studentDonutContainer", statusObj.total, "Total", [
        { label: "Pending", value: statusObj.pending, color: "#F6E5B8" },
        { label: "Submitted", value: statusObj.submitted, color: "#285747" },
        { label: "Overdue", value: statusObj.overdue, color: "#B42318" },
      ]);
    }

    // 2. Center Column: Recent Submissions
    const recentlySubmittedList = (data.recently_submitted || []).map((sub) => {
      const formattedDate = formatDisplayDate(sub.submitted_at);
      let statusBadge = "";
      if (sub.status === "Released" && sub.grade !== null && sub.grade !== undefined) {
        statusBadge = `<span class="submission-pill status-released">Released: ${sub.grade}/${sub.max_marks || 100}</span>`;
      } else {
        statusBadge = `<span class="submission-pill status-ungraded">Pending Review</span>`;
      }
      const resubmitBadge = sub.resubmission_allowed
        ? `<span class="submission-pill status-resubmit-allowed" style="font-size:0.7rem; padding: 0.15rem 0.45rem;">↻ Resubmit</span>`
        : "";

      return `
        <div class="dash-list-item" style="cursor: pointer;" onclick="navigateToView('submissions')">
          <div class="dash-item-main">
            <div class="dash-icon-box sage">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="dash-item-texts">
              <span class="dash-item-title">${escapeHtml(sub.assignment_title)}</span>
              <span class="dash-item-sub">${escapeHtml(sub.class_name)} &bull; ${formattedDate}</span>
            </div>
          </div>
          <div class="dash-item-meta" style="flex-direction: column; align-items: flex-end; gap: 0.25rem;">
            ${statusBadge}
            ${resubmitBadge}
          </div>
        </div>
      `;
    }).join("");

    elements.dashBottomCenterCard.className = "dash-box-card student-dash-card";
    elements.dashBottomCenterCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <h2 class="dash-card-title">Recent Submissions</h2>
        </div>
        <button class="dash-card-link" id="linkStudentRecentlySubmittedViewAll">View All &rarr;</button>
      </div>
      <div class="dash-list">
        ${recentlySubmittedList || '<div class="dash-empty-state"><p>No submissions yet.</p></div>'}
      </div>
    `;

    document.getElementById("linkStudentRecentlySubmittedViewAll")?.addEventListener("click", () => {
      navigateToView("submissions");
    });

    // 3. Right Column: Academic Progress & Feedback Guidance
    const totalCount = data.metrics.total_assignments || 0;
    const completedPct = totalCount > 0 ? Math.min(100, Math.round((data.metrics.submitted / totalCount) * 100)) : 0;

    elements.dashBottomRightCard.className = "dash-box-card student-dash-card";
    elements.dashBottomRightCard.innerHTML = `
      <div class="dash-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h2 class="dash-card-title">Academic Progress</h2>
        </div>
      </div>
      <div class="student-progress-body">
        <div class="student-progress-stat">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.4rem;">
            <span style="font-size: 0.825rem; font-weight: 600; color: var(--text-main);">Coursework Completed</span>
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">${completedPct}%</span>
          </div>
          <div class="student-progress-bar-wrap">
            <div class="student-progress-bar-fill" style="width: ${completedPct}%;"></div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.35rem; display: block;">${data.metrics.submitted} of ${totalCount} assignments submitted</span>
        </div>

        <div class="student-feedback-indicator-card">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="feedback-indicator-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${data.metrics.released || 0} Released Grades</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">Instructor feedback available</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btnStudentViewFeedback" type="button" style="margin-top: 0.75rem; width: 100%;">
            View Feedback & Results &rarr;
          </button>
        </div>
      </div>
    `;

    document.getElementById("btnStudentViewFeedback")?.addEventListener("click", () => {
      navigateToView("analytics");
    });

    // 4. Bottom Full Width: Keep Going Banner
    if (elements.dashFullWidthWrap) {
      elements.dashFullWidthWrap.style.display = "block";
      elements.dashFullWidthWrap.innerHTML = `
        <div class="dash-keep-going-banner">
          <div class="kg-left">
            <div class="kg-check-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 class="kg-text-title">Educational workflows, simplified.</h2>
              <p class="kg-text-desc">Track deadlines, submit coursework, and review teacher feedback seamlessly.</p>
            </div>
          </div>
          <div class="kg-illustration">
            ${STUDY_ILLUSTRATION_SVG}
          </div>
        </div>
      `;
    }
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
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    await applyAuthenticatedUserSession(data.user);
    closeAuthModal();
    showToast(`Welcome back, ${data.user.full_name}!`, "success");
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
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    await applyAuthenticatedUserSession(data.user);
    closeAuthModal();
    showToast(`Account created! Welcome, ${data.user.full_name}!`, "success");
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
  const epoch = state.authEpoch;
  try {
    await fetch(API_ENDPOINTS.authLogout, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
  } catch (err) {
    console.warn("Logout request error:", err);
  }

  clearUserState();
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
  const epoch = state.authEpoch;
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
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
 * Opens Curriculum Units & Assessments modal
 */
async function openStructureModal() {
  if (!state.currentUser) {
    openAuthModal("signin", "Please sign in to view curriculum units.");
    return;
  }

  if (elements.structureModalBackdrop) {
    elements.structureModalBackdrop.style.display = "flex";
  }
  if (elements.structureLoadingSpinner) elements.structureLoadingSpinner.style.display = "flex";
  if (elements.structureTreeContainer) elements.structureTreeContainer.innerHTML = "";
  if (elements.structureEmptyState) elements.structureEmptyState.style.display = "none";

  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/structure/units`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (elements.structureLoadingSpinner) elements.structureLoadingSpinner.style.display = "none";
    if (res.ok) {
      const data = await res.json();
      if (!data || !Array.isArray(data) || data.length === 0) {
        if (elements.structureEmptyState) elements.structureEmptyState.style.display = "block";
      } else {
        renderStructureTree(data);
      }
    } else {
      if (elements.structureEmptyState) {
        elements.structureEmptyState.style.display = "block";
        elements.structureEmptyState.innerHTML = `<p style="color: var(--danger);">Failed to load curriculum units.</p>`;
      }
    }
  } catch (err) {
    if (elements.structureLoadingSpinner) elements.structureLoadingSpinner.style.display = "none";
    if (elements.structureEmptyState) {
      elements.structureEmptyState.style.display = "block";
      elements.structureEmptyState.innerHTML = `<p style="color: var(--danger);">Failed to load curriculum units: ${escapeHtml(err.message || "Network error")}</p>`;
    }
  }
}

/**
 * Closes Curriculum Units modal
 */
function closeStructureModal() {
  if (elements.structureModalBackdrop) {
    elements.structureModalBackdrop.style.display = "none";
  }
}

/**
 * Renders hierarchical assessment tree by Class -> Subject -> Unit
 */
function renderStructureTree(classList) {
  if (!elements.structureTreeContainer) return;
  if (!classList || classList.length === 0) {
    if (elements.structureEmptyState) elements.structureEmptyState.style.display = "block";
    return;
  }
  if (elements.structureEmptyState) elements.structureEmptyState.style.display = "none";

  elements.structureTreeContainer.innerHTML = classList.map((c) => {
    const subjects = c.subjects || [];
    return `
      <div class="structure-class-card">
        <div class="structure-class-header">
          <h4 class="structure-class-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
              <path d="M6 6h10"></path>
              <path d="M6 10h10"></path>
            </svg>
            <span>${escapeHtml(c.class_name || "General")}</span>
          </h4>
          <span class="badge badge-secondary" style="font-size: 0.75rem;">${subjects.length} ${subjects.length === 1 ? 'Subject' : 'Subjects'}</span>
        </div>
        <div class="structure-subjects-grid">
          ${subjects.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.85rem;">No subjects registered.</p>' : subjects.map((s) => {
            const units = s.units || [];
            return `
              <div class="structure-subject-card">
                <div class="structure-subject-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>${escapeHtml(s.subject || "Unassigned")}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: auto;">${units.length} ${units.length === 1 ? 'Unit' : 'Units'}</span>
                </div>
                <div class="structure-units-list">
                  ${units.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.825rem;">No units registered.</p>' : units.map((u) => {
                    const dueFormatted = u.due_date ? formatDisplayDate(u.due_date) : "No due date";
                    return `
                      <div class="structure-unit-item">
                        <div class="structure-unit-header">
                          <span class="structure-unit-num">Unit ${u.unit || "—"}</span>
                          <span class="structure-unit-marks">${u.max_marks !== null && u.max_marks !== undefined ? u.max_marks + ' Marks' : '—'}</span>
                        </div>
                        <div class="structure-unit-assessment-title">${escapeHtml(u.title || "Untitled Assessment")}</div>
                        <div class="structure-unit-due">Due: ${dueFormatted}</div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
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

  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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

  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.classes}/${classId}/students`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
async function openSubmitWorkModal(assignment, submission = null) {
  state.currentSubmittingAssignment = assignment;
  let existingSub = submission || (state.mySubmissions ? state.mySubmissions[assignment.id] : null);

  if (!existingSub || existingSub.resubmission_allowed === undefined) {
    try {
      const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions/me`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        existingSub = await res.json();
        if (state.mySubmissions) {
          state.mySubmissions[assignment.id] = existingSub;
        }
      }
    } catch (e) {
      console.warn("Could not fetch submission details for submit modal:", e);
    }
  }

  state.currentSubmittingExistingSubmission = existingSub;
  resetSubmissionDropzone();
  if (elements.submissionNotes) elements.submissionNotes.value = "";
  if (elements.submissionFileError) elements.submissionFileError.textContent = "";
  if (elements.submitWorkAlert) {
    elements.submitWorkAlert.style.display = "none";
    elements.submitWorkAlert.textContent = "";
  }

  const isResubmission = Boolean(existingSub && existingSub.resubmission_allowed);

  let isExpired = false;
  let deadlineDate = null;
  if (isResubmission && existingSub.resubmission_deadline) {
    deadlineDate = new Date(existingSub.resubmission_deadline);
    if (deadlineDate.getTime() < Date.now()) {
      isExpired = true;
    }
  }

  if (isResubmission) {
    if (elements.submitWorkModalTitle) {
      elements.submitWorkModalTitle.textContent = "Resubmit Assignment Work";
    }
    if (elements.submitWorkModalSubtitle) {
      const nextAttempt = (existingSub.attempt_number || 1) + 1;
      elements.submitWorkModalSubtitle.textContent = `Submit revision attempt #${nextAttempt} • Previous attempt will be archived in history`;
    }
    if (elements.submitWorkBtnText) {
      elements.submitWorkBtnText.textContent = "Submit Revision";
    }

    if (elements.submitWorkResubmitBanner) {
      elements.submitWorkResubmitBanner.style.display = "block";
      if (elements.submitWorkResubmitTitle) {
        elements.submitWorkResubmitTitle.textContent = isExpired
          ? "⚠ Resubmission Window Closed"
          : "↻ Resubmission Authorized by Teacher";
      }
      if (elements.submitWorkResubmitNote) {
        if (existingSub.resubmission_note) {
          elements.submitWorkResubmitNote.textContent = `Teacher guidance: "${existingSub.resubmission_note}"`;
          elements.submitWorkResubmitNote.style.display = "block";
        } else {
          elements.submitWorkResubmitNote.textContent = "Your teacher has authorized a revision for this assignment.";
          elements.submitWorkResubmitNote.style.display = "block";
        }
      }
      if (elements.submitWorkResubmitDeadline) {
        if (deadlineDate) {
          elements.submitWorkResubmitDeadline.textContent = isExpired
            ? `Resubmission deadline passed on ${formatDisplayDateTime(existingSub.resubmission_deadline)}. Revisions can no longer be accepted.`
            : `Resubmission deadline: ${formatDisplayDateTime(existingSub.resubmission_deadline)}`;
          elements.submitWorkResubmitDeadline.style.display = "block";
        } else {
          elements.submitWorkResubmitDeadline.style.display = "none";
        }
      }
    }

    if (isExpired) {
      if (elements.submitWorkAlert) {
        elements.submitWorkAlert.className = "auth-alert error";
        elements.submitWorkAlert.textContent = "The resubmission deadline for this assignment has expired. New attempts cannot be submitted.";
        elements.submitWorkAlert.style.display = "block";
      }
      if (elements.btnSubmitWork) {
        elements.btnSubmitWork.disabled = true;
      }
    } else {
      if (elements.btnSubmitWork) {
        elements.btnSubmitWork.disabled = false;
      }
    }
  } else {
    // Normal first submission
    if (elements.submitWorkModalTitle) {
      elements.submitWorkModalTitle.textContent = "Submit Assignment Work";
    }
    if (elements.submitWorkModalSubtitle) {
      elements.submitWorkModalSubtitle.textContent = "Upload your completed solution";
    }
    if (elements.submitWorkBtnText) {
      elements.submitWorkBtnText.textContent = "Submit Work";
    }
    if (elements.submitWorkResubmitBanner) {
      elements.submitWorkResubmitBanner.style.display = "none";
    }
    if (elements.btnSubmitWork) {
      elements.btnSubmitWork.disabled = false;
    }
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
  state.currentSubmittingExistingSubmission = null;
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

  if (state.currentSubmittingExistingSubmission?.resubmission_allowed && state.currentSubmittingExistingSubmission.resubmission_deadline) {
    if (new Date(state.currentSubmittingExistingSubmission.resubmission_deadline).getTime() < Date.now()) {
      if (elements.submitWorkAlert) {
        elements.submitWorkAlert.className = "auth-alert error";
        elements.submitWorkAlert.textContent = "The resubmission deadline has expired. New attempts cannot be submitted.";
        elements.submitWorkAlert.style.display = "block";
      }
      if (elements.btnSubmitWork) elements.btnSubmitWork.disabled = true;
      return;
    }
  }

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
    const wasResubmission = Boolean(state.currentSubmittingExistingSubmission && state.currentSubmittingExistingSubmission.resubmission_allowed);

    // 1. Immediately update state.mySubmissions
    state.mySubmissions[state.currentSubmittingAssignment.id] = data;

    // 2. Immediately update matching entry in state.submissionsData without requiring a refresh
    if (Array.isArray(state.submissionsData)) {
      const subIdx = state.submissionsData.findIndex(
        (s) => s.assignment_id === data.assignment_id || s.id === data.id
      );
      if (subIdx !== -1) {
        state.submissionsData[subIdx] = {
          ...state.submissionsData[subIdx],
          ...data,
          status: "submitted",
          grade: null,
          feedback: null,
          resubmission_allowed: false,
          resubmission_deadline: null,
          resubmission_note: null,
          attempt_number: data.attempt_number || (state.submissionsData[subIdx].attempt_number || 1) + 1,
          file_name: data.file_name,
          file_size: data.file_size,
          submitted_at: data.submitted_at,
          notes: data.notes,
        };
      }
    }

    // 3. Immediately re-render My Submissions page if present in DOM
    filterAndRenderSubmissions();

    // 4. Update current viewing submission if open
    if (state.currentViewingSubmission && (state.currentViewingSubmission.id === data.id || state.currentViewingSubmission.assignment_id === data.assignment_id)) {
      state.currentViewingSubmission = {
        ...state.currentViewingSubmission,
        ...data,
        status: "submitted",
        grade: null,
        feedback: null,
        resubmission_allowed: false,
      };
    }

    // 5. Close submit modal
    closeSubmitWorkModal();

    if (wasResubmission) {
      showToast(`Revision submitted successfully! (Attempt #${data.attempt_number || 2})`, "success");
    } else {
      showToast("Work submitted successfully!", "success");
    }

    // 6. Synchronize assignments table and dashboard
    applyFiltersAndRender();
    if (state.activeView === "dashboard") {
      fetchDashboard();
    }
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

  if (!submission || submission.resubmission_allowed === undefined || !submission.download_url) {
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

  state.currentViewingAssignment = assignment;
  state.currentViewingSubmission = submission;

  // Assignment Title and Subtitle in modal header
  if (elements.viewSubmissionModalSubtitle) {
    elements.viewSubmissionModalSubtitle.textContent = assignment.title
      ? `${assignment.title} • ${assignment.class_name || "General"}`
      : "Submission details and file";
  }

  // Resubmission permission banner & button handling
  const resubAllowed = Boolean(submission.resubmission_allowed);
  let isResubExpired = false;
  let resubDeadlineDate = null;
  if (resubAllowed && submission.resubmission_deadline) {
    resubDeadlineDate = new Date(submission.resubmission_deadline);
    if (resubDeadlineDate.getTime() < Date.now()) {
      isResubExpired = true;
    }
  }

  if (elements.viewSubResubmitBanner) {
    if (resubAllowed) {
      elements.viewSubResubmitBanner.style.display = "block";
      if (elements.viewSubResubmitTitle) {
        elements.viewSubResubmitTitle.textContent = isResubExpired
          ? "Resubmission Deadline Expired"
          : "↻ Resubmission Permitted by Teacher";
      }
      if (elements.viewSubResubmitNote) {
        if (submission.resubmission_note) {
          elements.viewSubResubmitNote.textContent = `Teacher guidance: "${submission.resubmission_note}"`;
          elements.viewSubResubmitNote.style.display = "block";
        } else {
          elements.viewSubResubmitNote.textContent = "Your teacher has authorized a revised attempt for this assignment.";
          elements.viewSubResubmitNote.style.display = "block";
        }
      }
      if (elements.viewSubResubmitDeadline) {
        if (resubDeadlineDate) {
          elements.viewSubResubmitDeadline.textContent = isResubExpired
            ? `The resubmission deadline passed on ${formatDisplayDateTime(submission.resubmission_deadline)}. New attempts can no longer be accepted.`
            : `Resubmission deadline: ${formatDisplayDateTime(submission.resubmission_deadline)}`;
          elements.viewSubResubmitDeadline.style.display = "block";
        } else {
          elements.viewSubResubmitDeadline.style.display = "none";
        }
      }
    } else {
      elements.viewSubResubmitBanner.style.display = "none";
    }
  }

  if (elements.btnModalResubmitWork) {
    if (resubAllowed && !isResubExpired) {
      elements.btnModalResubmitWork.style.display = "inline-flex";
      elements.btnModalResubmitWork.disabled = false;
    } else {
      elements.btnModalResubmitWork.style.display = "none";
    }
  }

  if (elements.btnModalViewHistory) {
    if (submission.attempt_number && submission.attempt_number > 1) {
      elements.btnModalViewHistory.style.display = "inline-flex";
      const histSpan = elements.btnModalViewHistory.querySelector("span");
      if (histSpan) histSpan.textContent = `Attempt History (${submission.attempt_number})`;
    } else {
      elements.btnModalViewHistory.style.display = "none";
    }
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

    if (elements.btnModalRequestReeval) elements.btnModalRequestReeval.style.display = "inline-flex";
    if (elements.btnResultsCardReeval) elements.btnResultsCardReeval.style.display = "inline-flex";
    if (elements.viewSubReevalActionBox) elements.viewSubReevalActionBox.style.display = "flex";
  } else {
    if (elements.viewSubResultsCard) elements.viewSubResultsCard.style.display = "none";
    if (elements.viewSubPendingBanner) elements.viewSubPendingBanner.style.display = "flex";
    if (elements.btnModalRequestReeval) elements.btnModalRequestReeval.style.display = "none";
    if (elements.btnResultsCardReeval) elements.btnResultsCardReeval.style.display = "none";
    if (elements.viewSubReevalActionBox) elements.viewSubReevalActionBox.style.display = "none";
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
  state.currentViewingAssignment = null;
  state.currentViewingSubmission = null;
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
  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.assignments}/${assignment.id}/submissions`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
  if (index < 0 || !state.currentGradingSubmissions || index >= state.currentGradingSubmissions.length) return;
  state.currentGradingIndex = index;
  const sub = state.currentGradingSubmissions[index];
  if (!sub) return;

  state.currentGradingAssignment = {
    id: sub.assignment_id,
    title: sub.assignment_title || (state.currentGradingAssignment ? state.currentGradingAssignment.title : "Assignment"),
    class_name: sub.class_name || (state.currentGradingAssignment ? state.currentGradingAssignment.class_name : ""),
    max_marks: sub.max_marks || (state.currentGradingAssignment ? state.currentGradingAssignment.max_marks : 100),
  };
  const assignment = state.currentGradingAssignment;
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

  // Pending Re-evaluation Request Banner & Actions
  const hasReeval = Boolean(sub.needs_reevaluation || sub.reevaluation_reason || sub.reevaluation_id);
  if (elements.gradingReevaluationBanner) {
    if (hasReeval) {
      elements.gradingReevaluationBanner.style.display = "block";
      if (elements.gradingReevaluationReasonText) {
        elements.gradingReevaluationReasonText.textContent = sub.reevaluation_reason
          ? `"${sub.reevaluation_reason}"`
          : "Student requested a review of their assessed grade.";
      }
      if (elements.gradingResolveReevalBtn) {
        elements.gradingResolveReevalBtn.onclick = () => {
          openTeacherReevaluationModal({
            id: sub.reevaluation_id || sub.id,
            submission_id: sub.id,
            reason: sub.reevaluation_reason || "Student requested a review of their grade.",
            previous_grade: sub.grade,
          });
        };
      }
    } else {
      elements.gradingReevaluationBanner.style.display = "none";
    }
  }

  if (elements.gradingReviewReevalBtn) {
    elements.gradingReviewReevalBtn.style.display = hasReeval ? "inline-flex" : "none";
    if (hasReeval) {
      elements.gradingReviewReevalBtn.onclick = () => {
        openTeacherReevaluationModal({
          id: sub.reevaluation_id || sub.id,
          submission_id: sub.id,
          reason: sub.reevaluation_reason || "Student requested a review of their grade.",
          previous_grade: sub.grade,
        });
      };
    }
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
  const epoch = state.authEpoch;
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
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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
 * Opens Submission History & Archived Attempts Modal for teacher SpeedGrader
 */
function openTeacherSpeedGraderHistoryModal() {
  if (state.currentGradingIndex < 0 || !state.currentGradingSubmissions || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  openSubmissionHistoryModal(sub);
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
      `Authorizing a resubmission grants <strong>${escapeHtml(sub.student_name)}</strong> permission to upload a new attempt. Their existing attempt will be safely retained in submission history.`;
  }
  if (elements.resubmissionNotesInput) {
    elements.resubmissionNotesInput.value = sub.resubmission_note || "";
  }
  if (elements.resubmissionDeadlineInput) {
    if (sub.resubmission_deadline) {
      const d = new Date(sub.resubmission_deadline);
      const pad = (n) => String(n).padStart(2, "0");
      elements.resubmissionDeadlineInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
      elements.resubmissionDeadlineInput.value = "";
    }
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
 * Confirms Authorize Resubmission via authoritative backend API
 */
async function confirmAuthorizeResubmission() {
  if (state.currentGradingIndex < 0 || !state.currentGradingSubmissions || state.currentGradingIndex >= state.currentGradingSubmissions.length) return;
  const sub = state.currentGradingSubmissions[state.currentGradingIndex];
  if (!sub) return;

  const notes = elements.resubmissionNotesInput ? elements.resubmissionNotesInput.value.trim() : "";
  const deadlineVal = elements.resubmissionDeadlineInput ? elements.resubmissionDeadlineInput.value : "";
  let resubmissionDeadline = null;
  if (deadlineVal) {
    const d = new Date(deadlineVal);
    if (isNaN(d.getTime())) {
      showToast("Please provide a valid resubmission deadline date and time.", "error");
      return;
    }
    resubmissionDeadline = d.toISOString();
  }

  const confirmBtn = elements.confirmAuthorizeResubmissionBtn;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Authorizing...";
  }

  try {
    const res = await fetch(`${API_BASE}/api/submissions/${sub.id}/allow-resubmission`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        resubmission_note: notes || null,
        resubmission_deadline: resubmissionDeadline,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to authorize resubmission (HTTP ${res.status})`);
    }

    sub.resubmission_allowed = true;
    sub.resubmission_note = notes || null;
    sub.resubmission_deadline = resubmissionDeadline;

    showToast(`Resubmission authorized for ${sub.student_name}.`, "success");
    closeAuthorizeResubmissionModal();

    if (typeof openGradingWorkspace === "function") {
      openGradingWorkspace(state.currentGradingIndex);
    }
    if (typeof filterAndRenderSubmissions === "function") {
      filterAndRenderSubmissions();
    }
  } catch (err) {
    console.error("Authorize resubmission error:", err);
    showToast(err.message || "Failed to authorize resubmission.", "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Authorize Resubmission";
    }
  }
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
  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}/archive`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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
  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}/finalize`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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
  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semesterId}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;
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

async function viewSubjectDetail(subjectId, activeTab = "assignments", updateHash = true) {
  state.activeSubjectId = parseInt(subjectId, 10);
  state.activeSubjectTab = activeTab;
  navigateToView(`classes/${subjectId}`, updateHash);
}

async function renderSubjectDetailView() {
  if (!elements.classesPageContent || !state.activeSubjectId) return;

  const epoch = state.authEpoch;
  const isTeacher = state.currentUser?.role === "teacher";
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
  let activeTab = state.activeSubjectTab || "assignments";
  if (!isTeacher && activeTab === "students") {
    activeTab = "assignments";
    state.activeSubjectTab = "assignments";
  }

  if (activeTab === "students" && isTeacher) {
    // Screen 4: Student Performance (Subject-wise) - Teacher Only
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

  // Screen 3: Subject and Assignments
  elements.classesPageContent.innerHTML = `
    <div class="subject-detail-container">
      <!-- Breadcrumbs (Screen 3) -->
      <nav class="academic-breadcrumbs" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          ${isTeacher ? `
          <li class="breadcrumb-item"><a href="#semesters" onclick="navigateToView('semesters'); return false;">Semesters</a></li>
          <li class="breadcrumb-separator">›</li>
          <li class="breadcrumb-item"><a href="#dashboard" onclick="navigateToView('dashboard'); return false;">${escapeHtml(semName)}</a></li>
          ` : `
          <li class="breadcrumb-item"><a href="#classes" onclick="navigateToView('classes'); return false;">My Classes</a></li>
          `}
          <li class="breadcrumb-separator">›</li>
          <li class="breadcrumb-item active">${escapeHtml(subject.name)}</li>
        </ol>
      </nav>

      <!-- Page Header (Screen 3) -->
      <div class="page-header-row" style="margin-top: 0.5rem;">
        <div class="page-header-left">
          <h1 class="page-title">${escapeHtml(subject.name)}</h1>
          <p class="page-subtitle">${escapeHtml(subject.description || (isTeacher ? "Core Course Subject" : "Enrolled Course"))}</p>
        </div>
        <div class="page-header-actions">
          ${isTeacher ? `
          <button class="btn btn-primary" onclick="openCreateAssignmentForSubject(${subject.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>+ Create Assignment</span>
          </button>
          ` : ""}
          <button class="btn btn-outline" onclick="exitSubjectDetail()">
            <span>&larr; ${isTeacher ? "All Subjects" : "All Classes"}</span>
          </button>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="subject-tabs-nav">
        <button class="subject-tab-btn ${activeTab === 'overview' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'overview')">Overview</button>
        <button class="subject-tab-btn ${activeTab === 'assignments' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'assignments')">Assignments</button>
        ${isTeacher ? `<button class="subject-tab-btn ${activeTab === 'students' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'students')">Students</button>` : ""}
        <button class="subject-tab-btn ${activeTab === 'analytics' ? 'active' : ''}" onclick="viewSubjectDetail(${subject.id}, 'analytics')">${isTeacher ? "Analytics" : "Results"}</button>
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
          ${isTeacher ? `
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Student Join Code</span>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary); margin-top: 0.25rem; cursor: pointer;" onclick="copyJoinCode('${escapeHtml(subject.join_code)}')">
              ${escapeHtml(subject.join_code)}
            </div>
          </div>
          ` : `
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Instructor</span>
            <div style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem;">
              ${escapeHtml(subject.teacher_name || "Course Instructor")}
            </div>
          </div>
          <div>
            <span style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Status</span>
            <div style="margin-top: 0.25rem;">
              <span class="status-pill status-active" style="font-size: 0.8rem;">Enrolled</span>
            </div>
          </div>
          `}
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
    if (!isTeacher) {
      navigateToView("analytics");
      return;
    }
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
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

    if (res.ok) {
      const assignments = await res.json();
      if (assignments.length === 0) {
        contentWrap.innerHTML = `
          <div class="dash-empty-state" style="padding: 3rem 1rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
            <p>No assignments ${isTeacher ? "created" : "published"} for ${escapeHtml(subject.name)} yet.</p>
            ${isTeacher ? `
            <button class="btn btn-primary" onclick="openCreateAssignmentForSubject(${subject.id})" style="margin-top: 1rem;">
              + Create First Assignment
            </button>
            ` : ""}
          </div>
        `;
        return;
      }

      if (!isTeacher) {
        await fetchStudentSubmissions(assignments);
      }

      const rowsHtml = assignments.map((as, idx) => {
        const dueDateFormatted = formatShortDate(as.due_date);
        const typeLabel = as.assignment_type || "Assignment";
        const isDraft = as.status === "draft";
        const isClosed = as.status === "closed";
        const isOpen = as.status === "active" || as.status === "open";
        const statusClass = isOpen ? "open" : (isDraft ? "draft" : (isClosed ? "danger" : "info"));
        const statusLabel = isOpen ? "Open" : (isDraft ? "Draft" : (isClosed ? "Closed" : "Scheduled"));

        if (isTeacher) {
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
        }

        // Student-specific presentation
        const mySub = state.mySubmissions ? state.mySubmissions[as.id] : null;
        let myStatusBadge = `<span class="submission-pill status-unsubmitted">Not Submitted</span>`;
        let actionBtn = `
          <button class="btn btn-primary btn-sm" onclick="openSubmitWorkModal({ id: ${as.id}, title: '${escapeHtml(as.title)}', class_name: '${escapeHtml(subject.name)}' })">
            Submit Work
          </button>
        `;

        if (mySub) {
          if (mySub.status === "graded" && mySub.grade_released) {
            myStatusBadge = `<span class="submission-pill status-graded">Graded: ${mySub.grade}/${as.max_marks || 100}</span>`;
          } else if (mySub.status === "graded") {
            myStatusBadge = `<span class="submission-pill status-submitted">Pending Review</span>`;
          } else {
            myStatusBadge = `<span class="submission-pill status-submitted">Submitted</span>`;
          }
          actionBtn = `
            <button class="btn btn-secondary btn-sm" onclick="openViewSubmissionModal({ id: ${as.id}, title: '${escapeHtml(as.title)}', class_name: '${escapeHtml(subject.name)}' }, state.mySubmissions[${as.id}])">
              View Work
            </button>
          `;
        }

        return `
          <tr>
            <td style="color: #64748b; font-weight: 500;">${idx + 1}</td>
            <td style="font-weight: 600; color: #1e293b;">
              <span style="cursor: pointer;" onclick="${mySub ? `openViewSubmissionModal({ id: ${as.id}, title: '${escapeHtml(as.title)}', class_name: '${escapeHtml(subject.name)}' }, state.mySubmissions[${as.id}])` : `openSubmitWorkModal({ id: ${as.id}, title: '${escapeHtml(as.title)}', class_name: '${escapeHtml(subject.name)}' })`}">${escapeHtml(as.title)}</span>
            </td>
            <td><span class="type-pill">${escapeHtml(typeLabel)}</span></td>
            <td style="color: #475569; font-weight: 500;">${dueDateFormatted}</td>
            <td>${myStatusBadge}</td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>${actionBtn}</td>
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
                <th>${isTeacher ? "Submissions" : "My Submission"}</th>
                <th>Status</th>
                <th style="${isTeacher ? 'width: 60px;' : 'width: 140px;'}">Actions</th>
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
  navigateToView("classes", true);
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

  const epoch = state.authEpoch;
  try {
    const res = await fetch(`${API_ENDPOINTS.semesters}/${semId}/report`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: state.activeAbortController?.signal,
    });
    if (epoch !== state.authEpoch) return;

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


function renderAnalyticsOverview(ov) {
  if (elements.analyticsKpiRow) {
    const classAvgVal = (ov.class_average_percentage ?? ov.class_average);
    const subRateVal = (ov.submission_compliance_rate ?? ov.submission_rate);

    elements.analyticsKpiRow.innerHTML = `
      <div class="dash-metric-card">
        <div class="dash-metric-icon icon-blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${classAvgVal !== null && classAvgVal !== undefined ? classAvgVal + "%" : "—"}</span>
          <span class="dash-metric-label">Class Average Score</span>
        </div>
      </div>
      <div class="dash-metric-card">
        <div class="dash-metric-icon icon-amber"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${ov.total_students}</span>
          <span class="dash-metric-label">Enrolled Students</span>
        </div>
      </div>
      <div class="dash-metric-card">
        <div class="dash-metric-icon icon-green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${ov.total_assignments}</span>
          <span class="dash-metric-label">Units / Assessments</span>
        </div>
      </div>
      <div class="dash-metric-card">
        <div class="dash-metric-icon icon-purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="dash-metric-data">
          <span class="dash-metric-val">${subRateVal !== null && subRateVal !== undefined ? subRateVal + "%" : "0%"}</span>
          <span class="dash-metric-label">Submission Rate</span>
        </div>
      </div>
    `;
  }

  // Unit Comparisons
  if (elements.analyticsUnitComparisonsBody) {
    if (!ov.unit_comparisons || !ov.unit_comparisons.length) {
      elements.analyticsUnitComparisonsBody.innerHTML = `<div class="dash-empty-state"><p>No unit assessments recorded for this class.</p></div>`;
    } else {
      elements.analyticsUnitComparisonsBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${ov.unit_comparisons.map(u => {
            const unitTitle = u.title || u.assignment_title || "";
            const unitAvg = (u.average_percentage ?? u.average_score);
            const gradedCount = u.graded_count ?? u.released_count ?? 0;
            return `
              <div class="analytics-unit-item">
                <div class="analytics-unit-item-header">
                  <span class="analytics-unit-item-title">Unit ${u.unit}: ${escapeHtml(unitTitle)}</span>
                  <span class="analytics-unit-item-score">${unitAvg !== null && unitAvg !== undefined ? unitAvg + "% Avg" : "Ungraded"}</span>
                </div>
                <div class="analytics-unit-item-meta">
                  <span>Submissions: <strong>${u.submission_count ?? 0}</strong></span>
                  <span>Graded: <strong>${gradedCount}</strong></span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // Grade Distribution Card
  if (elements.analyticsRightCardBody) {
    const dist = ov.grade_distribution || (ov.distribution ? {
      "A (85-100%)": ov.distribution.grade_a,
      "B (70-84%)": ov.distribution.grade_b,
      "C (55-69%)": ov.distribution.grade_c,
      "D (40-54%)": ov.distribution.grade_d,
      "F (<40%)": ov.distribution.grade_f,
    } : {});
    const grades = [
      { label: "A (85-100%)", count: dist["A (85-100%)"] ?? dist["A (90-100%)"] ?? dist.grade_a ?? 0, color: "var(--success)" },
      { label: "B (70-84%)", count: dist["B (70-84%)"] ?? dist["B (80-89%)"] ?? dist.grade_b ?? 0, color: "var(--primary)" },
      { label: "C (55-69%)", count: dist["C (55-69%)"] ?? dist["C (70-79%)"] ?? dist.grade_c ?? 0, color: "var(--warning)" },
      { label: "D (40-54%)", count: dist["D (40-54%)"] ?? dist["D (60-69%)"] ?? dist.grade_d ?? 0, color: "#c27803" },
      { label: "F (<40%)", count: dist["F (<40%)"] ?? dist["F (<60%)"] ?? dist.grade_f ?? 0, color: "var(--danger)" },
    ];
    elements.analyticsRightCardBody.innerHTML = `
      <div class="analytics-dist-row">
        ${grades.map(g => `
          <div class="analytics-dist-item">
            <div class="analytics-dist-item-header">
              <span>${g.label}</span>
              <span style="font-weight: 600; color: var(--text-main);">${g.count} students</span>
            </div>
            <div class="analytics-dist-bar-track">
              <div class="analytics-dist-bar-fill" style="width: ${ov.total_students > 0 ? (g.count / ov.total_students) * 100 : 0}%; background: ${g.color};"></div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }
}

function renderAnalyticsRankings(rk) {
  if (elements.analyticsFinalizedBadge) {
    elements.analyticsFinalizedBadge.style.display = rk.is_finalized ? "block" : "none";
  }

  const units = rk.units || rk.required_units || [];
  if (elements.analyticsRankingsHead) {
    elements.analyticsRankingsHead.innerHTML = `
      <th>Rank</th>
      <th>Student</th>
      ${units.map(u => `<th>Unit ${u}</th>`).join("")}
      <th title="Calculated only from submitted and released units. Never treats unreleased work as zero.">Provisional %</th>
      <th title="Official final score when all required units are complete.">Final %</th>
      <th>Status</th>
    `;
  }

  if (elements.analyticsRankingsBody) {
    if (!rk.rankings || !rk.rankings.length) {
      elements.analyticsRankingsBody.innerHTML = `<tr><td colspan="${5 + units.length}" style="text-align: center; padding: 2rem; color: var(--text-muted);">No student rankings found for this subject.</td></tr>`;
      return;
    }

    elements.analyticsRankingsBody.innerHTML = rk.rankings.map((s, idx) => {
      const isYou = state.currentUser?.id === s.student_id;
      const rankVal = s.rank ?? (s.is_complete ? s.final_rank : s.provisional_rank) ?? (idx + 1);
      const isComplete = Boolean(s.is_complete || s.status === "finalized");
      const statusPill = isComplete
        ? `<span class="submission-pill status-graded" style="font-size:0.75rem;">Complete</span>`
        : `<span class="submission-pill status-draft" style="font-size:0.75rem;">Provisional</span>`;

      const provDisplay = (s.provisional_percentage !== null && s.provisional_percentage !== undefined)
        ? s.provisional_percentage + "%"
        : "—";

      const finalDisplay = (isComplete && s.final_percentage !== null && s.final_percentage !== undefined)
        ? s.final_percentage + "%"
        : `<span style="color:var(--text-muted); font-style:italic;">Pending</span>`;

      const unitCols = units.map(u => {
        let m = null;
        if (s.unit_marks && s.unit_marks[u] !== undefined) {
          m = s.unit_marks[u];
        } else if (Array.isArray(s.units)) {
          const uObj = s.units.find(x => x.unit === u);
          if (uObj && uObj.score !== null && uObj.score !== undefined) {
            m = uObj.score + "/" + uObj.max_marks;
          }
        }
        return "<td>" + (m !== null && m !== undefined ? m : "—") + "</td>";
      }).join("");

      const isTeacher = state.currentUser?.role === "teacher";
      const displayName = (isTeacher || isYou) ? s.student_name : `Student #${idx + 1}`;

      return `
        <tr ${isYou ? 'class="rankings-current-user-row"' : ''}>
          <td><strong>#${rankVal}</strong></td>
          <td>${escapeHtml(displayName)}${isYou ? ' <span class="rankings-you-badge">You</span>' : ''}</td>
          ${unitCols}
          <td><strong style="color: var(--primary);">${provDisplay}</strong></td>
          <td>${finalDisplay}</td>
          <td>${statusPill}</td>
        </tr>
      `;
    }).join("");
  }
}

function renderTeacherAlerts(alerts) {
  if (!elements.analyticsAlertsContainer) return;

  const atRisk = alerts.at_risk_students || [];
  const backlog = alerts.grading_backlog || [];
  const ungraded = alerts.ungraded_count || 0;
  const unreleased = alerts.unreleased_count || 0;

  if (!atRisk.length && !backlog.length && !ungraded && !unreleased) {
    elements.analyticsAlertsContainer.style.display = "none";
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">`;

  if (atRisk.length > 0) {
    html += `
      <div class="analytics-alert-card danger">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div style="flex: 1;">
          <h4 class="analytics-alert-title">Students Requiring Academic Support (${atRisk.length})</h4>
          <div class="analytics-alert-tags">
            ${atRisk.map(s => {
              const scoreVal = (s.provisional_percentage ?? s.provisional_score);
              const scoreDisplay = scoreVal !== null && scoreVal !== undefined ? scoreVal + '%' : '0%';
              return `<span class="analytics-alert-tag danger">${escapeHtml(s.student_name)} (${scoreDisplay}${s.reason ? ` - ${escapeHtml(s.reason)}` : ''})</span>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }
  if (backlog.length > 0) {
    html += `
      <div class="analytics-alert-card warning">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="flex: 1;">
          <h4 class="analytics-alert-title">Ungraded Assessment Backlog (${backlog.length} Units)</h4>
          <div class="analytics-alert-tags">
            ${backlog.map(b => `<span class="analytics-alert-tag warning">${escapeHtml(b.title)}: ${b.pending_count} pending</span>`).join("")}
          </div>
        </div>
      </div>
    `;
  } else if (ungraded > 0 || unreleased > 0) {
    html += `
      <div class="analytics-alert-card warning">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="flex: 1;">
          <h4 class="analytics-alert-title">Assessment Grading & Release Backlog</h4>
          <div class="analytics-alert-tags">
            ${ungraded > 0 ? `<span class="analytics-alert-tag warning">${ungraded} Pending Submissions to Grade</span>` : ''}
            ${unreleased > 0 ? `<span class="analytics-alert-tag warning">${unreleased} Graded Assessments Awaiting Release</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }
  html += `</div>`;
  elements.analyticsAlertsContainer.innerHTML = html;
  elements.analyticsAlertsContainer.style.display = "block";
}
