def test_frontend_root_serves_html(client):
    """Verify that root endpoint GET / serves the AssignFlow dashboard HTML."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    html = response.text
    assert "AssignFlow" in html
    assert "Assignments" in html
    assert "assignmentsTable" in html
    assert "assignmentDrawer" in html


def test_frontend_static_css_served(client):
    """Verify that /css/style.css is properly mounted and served."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    assert "text/css" in response.headers.get("content-type", "")
    assert "--primary: #6366f1;" in response.text


def test_frontend_static_js_served(client):
    """Verify that /js/app.js is properly mounted and served."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    assert "javascript" in response.headers.get("content-type", "")
    assert "fetchAssignments" in response.text


def test_frontend_includes_pdf_upload_field(client):
    """Verify that index.html contains the PDF question upload field and dropzone."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="formPdf"' in html
    assert 'id="fileDropzone"' in html
    assert 'id="currentAttachmentBox"' in html
    assert 'id="pdfError"' in html


def test_frontend_includes_authentication_ui_elements(client):
    """Verify that index.html includes auth modal, forms, role selectors, and dropdown menu."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="authModalBackdrop"' in html
    assert 'id="tabSignIn"' in html
    assert 'id="tabRegister"' in html
    assert 'id="signInForm"' in html
    assert 'id="registerForm"' in html
    assert 'id="roleTeacherCard"' in html
    assert 'id="roleStudentCard"' in html
    assert 'id="closeAuthModalBtn"' in html
    assert 'id="profileMenu"' in html
    assert 'id="menuLogoutBtn"' in html


def test_frontend_css_includes_auth_and_profile_styles(client):
    """Verify that style.css includes classes for the auth modal, form layout, role badges, and dropdown."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text
    assert ".auth-modal-card" in css
    assert ".auth-form" in css
    assert "flex-direction: column" in css
    assert ".role-selector-grid" in css
    assert ".profile-dropdown-menu" in css
    assert ".role-badge" in css
    assert ".role-option-card" in css


def test_frontend_js_includes_auth_handlers(client):
    """Verify that app.js includes authentication lifecycle routines."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    assert "checkCurrentUser" in js
    assert "handleLoginSubmit" in js
    assert "handleRegisterSubmit" in js
    assert "handleLogout" in js
    assert "credentials: \"same-origin\"" in js


def test_frontend_includes_classes_ui_elements(client):
    """Verify that index.html contains classes modal, nav links, filters, and drawer elements."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="classesModalBackdrop"' in html
    assert 'id="openClassesModalBtn"' in html
    assert 'id="sidebarClassesLink"' in html
    assert 'id="classFilter"' in html
    assert 'id="formClass"' in html
    assert 'id="createClassForm"' in html
    assert 'id="joinClassForm"' in html
    assert 'id="teacherClassesView"' in html
    assert 'id="studentClassesView"' in html
    assert 'id="classStudentsView"' in html


def test_frontend_css_includes_classes_styles(client):
    """Verify that style.css includes classes styling for modal, pills, cards, and student tables."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text
    assert ".classes-modal-card" in css
    assert ".class-pill" in css
    assert ".class-card-item" in css
    assert ".students-table" in css


def test_frontend_js_includes_classes_handlers(client):
    """Verify that app.js includes class management API interaction functions."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    assert "fetchClasses" in js
    assert "openClassesModal" in js
    assert "closeClassesModal" in js
    assert "handleCreateClassSubmit" in js
    assert "handleJoinClassSubmit" in js
    assert "handleViewClassStudents" in js
    assert "populateClassFilterOptions" in js


def test_frontend_includes_submissions_ui_elements(client):
    """Verify that index.html contains student and teacher submission modals and elements."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="submitWorkModalBackdrop"' in html
    assert 'id="submitWorkForm"' in html
    assert 'id="submissionFileInput"' in html
    assert 'id="submissionDropzone"' in html
    assert 'id="submissionNotes"' in html
    assert 'id="btnSubmitWork"' in html
    assert 'id="viewSubmissionModalBackdrop"' in html
    assert 'id="btnDownloadMySubmission"' in html
    assert 'id="teacherSubmissionsModalBackdrop"' in html
    assert 'id="teacherSubmissionsTable"' in html
    assert 'id="teacherSubmissionsEmptyState"' in html


def test_frontend_css_includes_submissions_styles(client):
    """Verify that style.css includes classes for submissions modals, pills, and action buttons."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text
    assert ".submit-work-modal-card" in css
    assert ".view-submission-modal-card" in css
    assert ".teacher-submissions-modal-card" in css
    assert ".submission-pill" in css
    assert ".status-ontime" in css
    assert ".status-late" in css
    assert ".submit-work-btn" in css
    assert ".submissions-btn" in css


def test_frontend_js_includes_submissions_handlers(client):
    """Verify that app.js includes submission lifecycle functions and handlers."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    assert "fetchStudentSubmissions" in js
    assert "openSubmitWorkModal" in js
    assert "closeSubmitWorkModal" in js
    assert "handleSubmitWorkForm" in js
    assert "openViewSubmissionModal" in js
    assert "closeViewSubmissionModal" in js
    assert "openTeacherSubmissionsModal" in js
    assert "closeTeacherSubmissionsModal" in js
    assert "handleSubmissionFileSelection" in js
    assert "resetSubmissionDropzone" in js


def test_frontend_includes_dashboard_ui_elements(client):
    """Verify that index.html contains dashboard view containers, metrics row, cards, and CTA elements."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="dashboardView"' in html
    assert 'id="assignmentsView"' in html
    assert 'id="dashGreeting"' in html
    assert 'id="dashUserName"' in html
    assert 'id="dashRolePill"' in html
    assert 'id="dashHeroCtaBtn"' in html
    assert 'id="dashMetricsRow"' in html
    assert 'id="dashMidLeftCard"' in html
    assert 'id="dashMidRightCard"' in html
    assert 'id="dashBottomLeftCard"' in html
    assert 'id="dashBottomRightCard"' in html
    assert 'id="dashFullWidthWrap"' in html
    assert 'id="sidebarSignOutBtn"' in html
    assert 'id="navDashboard"' in html


def test_frontend_css_includes_dashboard_styles(client):
    """Verify that style.css includes classes for the dashboard matching the reference screenshot."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text
    assert ".dashboard-view-content" in css
    assert ".dash-hero-banner" in css
    assert ".dash-role-pill" in css
    assert ".dash-metrics-row" in css
    assert ".dash-metric-card" in css
    assert ".dash-mid-row" in css
    assert ".dash-bottom-row" in css
    assert ".donut-chart-wrap" in css
    assert ".dash-date-badge" in css
    assert ".dash-quick-actions-card" in css
    assert ".dash-keep-going-banner" in css
    assert ".sidebar-signout-btn" in css


def test_frontend_js_includes_dashboard_handlers(client):
    """Verify that app.js includes dashboard fetching, rendering, navigation, and SVG donut charting."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    assert "fetchDashboard" in js
    assert "renderDashboard" in js
    assert "navigateToView" in js
    assert "renderDonutChart" in js
    assert "STUDY_ILLUSTRATION_SVG" in js
    assert "API_ENDPOINTS" in js
    assert "dashboard" in js


def test_frontend_includes_all_sidebar_page_views(client):
    """Verify that index.html contains standalone containers for all 7 sidebar navigation items."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    # 7 dedicated page containers
    assert 'id="dashboardView"' in html
    assert 'id="assignmentsView"' in html
    assert 'id="classesView"' in html
    assert 'id="submissionsView"' in html
    assert 'id="calendarView"' in html
    assert 'id="analyticsView"' in html
    assert 'id="settingsView"' in html

    # All page containers share standard page-view class
    assert 'class="page-view' in html
    assert 'id="classesPageContent"' in html
    assert 'id="submissionsTableBody"' in html
    assert 'id="calendarDeadlinesList"' in html
    assert 'id="analyticsKpiRow"' in html
    assert 'id="settingsEmail"' in html


def test_frontend_css_includes_page_views_styles(client):
    """Verify that style.css includes styling for all new functional pages."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text
    assert ".classes-cards-grid" in css
    assert ".class-box-card" in css
    assert ".class-join-code-badge" in css
    assert ".submissions-table-card" in css
    assert ".calendar-layout-grid" in css
    assert ".calendar-timeline-list" in css
    assert ".calendar-item" in css
    assert ".calendar-mini-table" in css
    assert ".settings-cards-grid" in css
    assert ".settings-box-card" in css


def test_frontend_js_includes_hash_routing_and_page_loaders(client):
    """Verify that app.js includes hash-change routing and dedicated page loaders."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    # Hashchange listener
    assert "hashchange" in js
    # Dedicated page loaders
    assert "loadClassesPageView" in js
    assert "loadSubmissionsPageView" in js
    assert "loadCalendarPageView" in js
    assert "loadAnalyticsPageView" in js
    assert "loadSettingsPageView" in js
    # Submissions filtering and rendering
    assert "filterAndRenderSubmissions" in js
    # Supported views map or checks
    assert "classes" in js
    assert "submissions" in js
    assert "calendar" in js
    assert "analytics" in js
    assert "settings" in js


def test_frontend_includes_teacher_grading_ui_elements(client):
    """Verify that index.html contains the teacher grading roster headers, SpeedGrader workspace, and confirmation dialogs."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text

    # Teacher Submissions Roster Elements
    assert '<th>Grade</th>' in html
    assert '<th>Status</th>' in html
    assert 'id="teacherReleaseAllBtn"' in html
    assert 'id="teacherReleaseAllCount"' in html

    # SpeedGrader Workspace Modal Elements
    assert 'id="gradingWorkspaceModalBackdrop"' in html
    assert 'id="gradingWorkspaceTitle"' in html
    assert 'id="gradingPrevStudentBtn"' in html
    assert 'id="gradingNextStudentBtn"' in html
    assert 'id="gradingStudentCounter"' in html
    assert 'id="closeGradingWorkspaceBtn"' in html
    assert 'id="gradingDownloadBtn"' in html
    assert 'id="gradingPdfContainer"' in html
    assert 'id="gradingPdfIframe"' in html
    assert 'id="gradingPdfSpinner"' in html
    assert 'id="gradingNonPdfFallback"' in html
    assert 'id="gradingNonPdfFilename"' in html
    assert 'id="gradingNonPdfDownloadBtn"' in html
    assert 'id="gradingStudentName"' in html
    assert 'id="gradingStudentEmail"' in html
    assert 'id="gradingMarksInput"' in html
    assert 'id="gradingMaxMarksLabel"' in html
    assert 'id="gradingFeedbackInput"' in html
    assert 'id="gradingSaveDraftBtn"' in html
    assert 'id="gradingSaveNextBtn"' in html
    assert 'id="gradingReleaseSingleBtn"' in html

    # Confirmation Modals
    assert 'id="singleReleaseConfirmBackdrop"' in html
    assert 'id="confirmSingleReleaseBtn"' in html
    assert 'id="cancelSingleReleaseBtn"' in html
    assert 'id="bulkReleaseConfirmBackdrop"' in html
    assert 'id="confirmBulkReleaseBtn"' in html
    assert 'id="cancelBulkReleaseBtn"' in html


def test_frontend_css_includes_teacher_grading_styles(client):
    """Verify that style.css includes SpeedGrader layout, preview frame, fallback cards, and responsive rules."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text

    assert ".grading-workspace-modal-card" in css
    assert ".grading-workspace-layout" in css
    assert ".grading-preview-panel" in css
    assert ".grading-sidebar-panel" in css
    assert ".grading-pdf-frame" in css
    assert ".grading-non-pdf-fallback" in css
    assert ".status-ungraded" in css
    assert ".status-graded-draft" in css
    assert ".status-released" in css
    assert ".btn-success" in css
    assert "button:disabled" in css or ".btn:disabled" in css
    assert "@media (max-width: 960px)" in css


def test_frontend_js_includes_grading_workspace_and_release_handlers(client):
    """Verify that app.js includes grading workspace navigation, draft saving, single release, and bulk release."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text

    assert "openGradingWorkspace" in js
    assert "closeGradingWorkspaceModal" in js
    assert "navigateGradingWorkspace" in js
    assert "saveGrade" in js
    assert "openSingleReleaseModal" in js
    assert "confirmSingleRelease" in js
    assert "openBulkReleaseModal" in js
    assert "confirmBulkRelease" in js
    assert "renderTeacherSubmissionsRoster" in js
    assert "updateTeacherReleaseAllButton" in js
    assert "release-grades" in js
    assert "preview" in js
    assert "gradingDownloadBtn" in js
    assert "gradingPdfSpinner" in js
    assert "submissions-review-btn" in js



def test_frontend_includes_student_results_ui_elements(client):
    """Verify that index.html contains the student results card, pending banner, and preview actions."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text

    # Student View Submission Modal Result Cards & Elements
    assert 'id="viewSubResultsCard"' in html
    assert 'id="viewSubScoreVal"' in html
    assert 'id="viewSubScoreMax"' in html
    assert 'id="viewSubScorePct"' in html
    assert 'id="viewSubFeedbackBox"' in html
    assert 'id="viewSubFeedbackText"' in html
    assert 'id="viewSubPendingBanner"' in html
    assert 'id="btnPreviewMySubmission"' in html
    assert 'id="btnDownloadMySubmission"' in html


def test_frontend_css_includes_student_results_styles(client):
    """Verify that style.css includes styling for student results cards, scores, feedback box, and pending review banners."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text

    assert ".student-results-card" in css
    assert ".results-score-display" in css
    assert ".score-val" in css
    assert ".results-feedback-box" in css
    assert ".feedback-content" in css
    assert ".student-pending-banner" in css
    assert ".pending-title" in css


def test_frontend_js_includes_student_results_and_dashboard_integration(client):
    """Verify that app.js includes student results display, review status logic, and dashboard integration."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text

    assert "viewSubResultsCard" in js
    assert "viewSubPendingBanner" in js
    assert "viewSubScoreVal" in js
    assert "openViewSubmissionModal" in js
    assert "Pending Review" in js
    assert "Released" in js
    assert "btnPreviewMySubmission" in js
    assert "filterAndRenderSubmissions" in js
    assert "renderDashboard" in js


def test_frontend_includes_submission_preview_modal_elements(client):
    """Verify that index.html contains the dedicated submission preview modal and iframe."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text

    assert 'id="submissionPreviewModalBackdrop"' in html
    assert 'id="submissionPreviewModalTitle"' in html
    assert 'id="submissionPreviewSubtitle"' in html
    assert 'id="submissionPreviewDownloadTopBtn"' in html
    assert 'id="closeSubmissionPreviewModalBtn"' in html
    assert 'id="submissionPreviewAlert"' in html
    assert 'id="submissionPreviewSpinner"' in html
    assert 'id="submissionPreviewContainer"' in html
    assert 'id="submissionPreviewIframe"' in html
    assert 'id="submissionPreviewFallback"' in html
    assert 'id="submissionPreviewFallbackFilename"' in html
    assert 'id="submissionPreviewFallbackMeta"' in html
    assert 'id="submissionPreviewFallbackDownloadBtn"' in html


def test_frontend_css_includes_submission_preview_styles(client):
    """Verify that style.css includes styling for submission preview modal, iframe, and preview buttons."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text

    assert ".submission-preview-modal-card" in css
    assert ".submission-preview-header" in css
    assert ".submission-preview-body" in css
    assert ".submission-preview-container" in css
    assert ".submission-preview-iframe" in css
    assert ".preview-modal-spinner" in css
    assert ".submission-preview-fallback" in css
    assert ".table-action-btn.preview-btn:hover" in css


def test_frontend_js_includes_submission_preview_handlers(client):
    """Verify that app.js includes submission preview modal opening, closing, and separate actions."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text

    assert "openSubmissionPreviewModal" in js
    assert "closeSubmissionPreviewModal" in js
    assert "submissionPreviewModalBackdrop" in js
    assert "submissionPreviewIframe" in js
    assert "submissionPreviewFallback" in js
    assert "preview-sub-btn" in js
    assert "previewBtn" in js
    assert "roster-preview-btn" in js


def test_frontend_includes_bulk_operations_and_exports_ui(client):
    """Verify that index.html contains Export CSV, Download ZIP, and multi-select checkbox controls."""
    response = client.get("/")
    assert response.status_code == 200
    html = response.text
    assert 'id="teacherExportCsvBtn"' in html
    assert 'id="teacherDownloadZipBtn"' in html
    assert 'id="teacherSelectAllSubmissions"' in html
    assert 'id="teacherSelectedCountBanner"' in html
    assert 'id="teacherSelectedCount"' in html


def test_frontend_js_includes_bulk_operations_and_exports_handlers(client):
    """Verify that app.js includes CSV export, ZIP download, and selective bulk release handlers."""
    response = client.get("/js/app.js")
    assert response.status_code == 200
    js = response.text
    assert "handleExportCsv" in js
    assert "handleDownloadZip" in js
    assert "updateSubmissionSelectionUI" in js
    assert "handleToggleSelectAllSubmissions" in js
    assert "selectedSubmissionIds" in js
    assert "/export/csv" in js
    assert "/export/zip" in js


def test_frontend_js_syntax_integrity(client):
    """Verify frontend JavaScript syntax integrity using Pygments JavascriptLexer."""
    from pygments.lexers.javascript import JavascriptLexer
    from pygments.token import Error

    response = client.get("/js/app.js")
    assert response.status_code == 200
    content = response.text

    lexer = JavascriptLexer()
    lex_errors = [(pos, val) for pos, tok, val in lexer.get_tokens_unprocessed(content) if tok in Error]
    assert len(lex_errors) == 0, f"JavaScript lexical syntax errors found: {lex_errors[:5]}"


def test_frontend_css_responsive_cascade(client):
    """Verify that style.css base modal rules appear before responsive media queries."""
    response = client.get("/css/style.css")
    assert response.status_code == 200
    css = response.text

    # Locate the preview modal styling block
    base_idx = css.find(".submission-preview-modal-card {")
    assert base_idx != -1, ".submission-preview-modal-card not found in style.css"

    # In the modal section, verify cascade order: base -> 960px -> 480px -> 360px
    modal_section = css[base_idx:]
    media_960_idx = modal_section.find("@media (max-width: 960px)")
    media_480_idx = modal_section.find("@media (max-width: 480px)")
    media_360_idx = modal_section.find("@media (max-width: 360px)")

    assert media_960_idx != -1, "@media (max-width: 960px) not found after base modal definition"
    assert media_480_idx != -1, "@media (max-width: 480px) not found in modal section"
    assert media_360_idx != -1, "@media (max-width: 360px) not found in modal section"

    # Base definition precedes media queries, and breakpoints narrow down progressively
    assert media_960_idx < media_480_idx, "960px media query must precede 480px media query"
    assert media_480_idx < media_360_idx, "480px media query must precede 360px media query"


def test_frontend_modular_components_exist():
    """Verify that all modular HTML components and pages exist and are non-empty."""
    from pathlib import Path
    repo_root = Path(__file__).resolve().parent.parent.parent
    frontend_dir = repo_root / "frontend"

    required_components = [
        "components/sidebar.html",
        "components/navbar.html",
        "components/assignment-drawer.html",
        "components/modals.html",
        "pages/dashboard.html",
        "pages/assignments.html",
        "pages/classes.html",
        "pages/submissions.html",
        "pages/calendar.html",
        "pages/analytics.html",
        "pages/settings.html",
        "index.template.html",
    ]

    for rel_path in required_components:
        target = frontend_dir / rel_path
        assert target.exists(), f"Required modular component missing: {rel_path}"
        content = target.read_text(encoding="utf-8").strip()
        assert len(content) > 0, f"Component file is empty: {rel_path}"


def test_frontend_modular_components_key_elements():
    """Verify that specific modular components contain their expected core DOM IDs."""
    from pathlib import Path
    repo_root = Path(__file__).resolve().parent.parent.parent
    frontend_dir = repo_root / "frontend"

    # Sidebar
    sidebar_html = (frontend_dir / "components/sidebar.html").read_text(encoding="utf-8")
    assert 'id="sidebar"' in sidebar_html
    assert 'id="sidebarCloseBtn"' in sidebar_html
    assert 'id="sidebarClassesLink"' in sidebar_html

    # Navbar
    navbar_html = (frontend_dir / "components/navbar.html").read_text(encoding="utf-8")
    assert 'id="menuToggleBtn"' in navbar_html
    assert 'id="profileMenu"' in navbar_html
    assert 'id="menuLogoutBtn"' in navbar_html

    # Modals
    modals_html = (frontend_dir / "components/modals.html").read_text(encoding="utf-8")
    assert 'id="deleteModalBackdrop"' in modals_html
    assert 'id="authModalBackdrop"' in modals_html
    assert 'id="classesModalBackdrop"' in modals_html
    assert 'id="submitWorkModalBackdrop"' in modals_html
    assert 'id="viewSubmissionModalBackdrop"' in modals_html
    assert 'id="teacherSubmissionsModalBackdrop"' in modals_html
    assert 'id="gradingWorkspaceModalBackdrop"' in modals_html
    assert 'id="submissionPreviewModalBackdrop"' in modals_html

    # Pages
    assert 'id="dashboardView"' in (frontend_dir / "pages/dashboard.html").read_text(encoding="utf-8")
    assert 'id="assignmentsView"' in (frontend_dir / "pages/assignments.html").read_text(encoding="utf-8")
    assert 'id="classesView"' in (frontend_dir / "pages/classes.html").read_text(encoding="utf-8")
    assert 'id="submissionsView"' in (frontend_dir / "pages/submissions.html").read_text(encoding="utf-8")
    assert 'id="calendarView"' in (frontend_dir / "pages/calendar.html").read_text(encoding="utf-8")
    assert 'id="analyticsView"' in (frontend_dir / "pages/analytics.html").read_text(encoding="utf-8")
    assert 'id="settingsView"' in (frontend_dir / "pages/settings.html").read_text(encoding="utf-8")


def test_frontend_assembly_integrity():
    """Verify that frontend/index.html is in exact sync with index.template.html and all components."""
    import subprocess
    import sys
    from pathlib import Path
    repo_root = Path(__file__).resolve().parent.parent.parent
    assemble_script = repo_root / "frontend" / "assemble.py"

    result = subprocess.run(
        [sys.executable, str(assemble_script), "--check"],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Assembly integrity check failed:\n{result.stderr}\n{result.stdout}"
