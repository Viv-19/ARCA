import React from 'react';

// Modular Components
import { Toast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DetailModal } from './components/DetailModal';
import { EvidenceModal } from './components/EvidenceModal';
import { EditModal } from './components/EditModal';
import { AllDocsModal } from './components/AllDocsModal';

// Pages / Tabs
import { DashboardTab } from './pages/DashboardTab';
import { ReviewQueueTab } from './pages/ReviewQueueTab';
import { DispatchTrackerTab } from './pages/DispatchTrackerTab';
import { DepartmentBoardTab } from './pages/DepartmentBoardTab';
import { CircularIngestTab } from './pages/CircularIngestTab';
import { AgentWorkbenchTab } from './pages/AgentWorkbenchTab';

// App Logic Hook
import { useAppEngine } from './hooks/useAppEngine';

// API service config needed for Sidebar & AllDocsModal URL links
import { BACKEND_URL } from './services/api';

import './App.css';

function App() {
  const {
    activeTab,
    setActiveTab,
    overallScore,
    totalActive,
    totalOverdue,
    totalAtRisk,
    departments,
    alerts,
    recentLogs,
    bulkList,
    selectedDeptId,
    setSelectedDeptId,
    deptMaps,
    evidenceFiles,
    setEvidenceFiles,
    evidenceNotes,
    setEvidenceNotes,
    evidenceType,
    setEvidenceType,
    selectedFile,
    setSelectedFile,
    uploadProgress,
    scraperStatus,
    manualRegulator,
    setManualRegulator,
    manualType,
    setManualType,
    documents,
    allDocsModalOpen,
    setAllDocsModalOpen,
    pipelineProgress,
    activeMap,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isEvidenceModalOpen,
    setIsEvidenceModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    editFields,
    setEditFields,
    overrideVerdict,
    setOverrideVerdict,
    overrideReason,
    setOverrideReason,
    validationScript,
    mapAuditLogs,
    isConnected,
    wsLogs,
    toast,
    pendingMaps,
    activeDispatches,
    scoreColor,
    handleTriggerPipeline,
    handleDeleteDocument,
    handleAlertScan,
    handleMarkAlertRead,
    handleApproveMap,
    handleRejectMap,
    openEditModal,
    handleSubmitEdit,
    openEvidenceModal,
    handleSubmitEvidence,
    openDetailModal,
    handleOverrideValidation,
    handleUploadDocument,
    handleTriggerScraper,
    toggleBulk,
    handleBulkApprove,
    activePipelineDocId,
    workbenchStep,
    draftMapsList,
    setDraftMapsList,
    executiveSummary,
    riskScore,
    conflictAlerts,
    generatedScripts,
    handleSelectActiveDoc,
    handleConfirmMaps,
    handleConfirmRouting,
    handlePublishPipeline,
  } = useAppEngine();

  return (
    <div className="app-container">

      {/* ═══════ SIDEBAR ═══════ */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingMapsCount={pendingMaps.length}
        activeDispatchesCount={activeDispatches.length}
        isConnected={isConnected}
        documents={documents}
        pipelineProgress={pipelineProgress}
        onTriggerPipeline={handleTriggerPipeline}
        onOpenAllDocs={() => setAllDocsModalOpen(true)}
        wsLogs={wsLogs}
        BACKEND_URL={BACKEND_URL}
      />

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className="main-content">
        
        {/* Command Center Header */}
        <Header />

        {/* ═══════ TAB 1: EXECUTIVE PANEL ═══════ */}
        {activeTab === 'dashboard' && (
          <DashboardTab 
            overallScore={overallScore}
            totalActive={totalActive}
            totalAtRisk={totalAtRisk}
            totalOverdue={totalOverdue}
            alerts={alerts}
            departments={departments}
            recentLogs={recentLogs}
            onAlertScan={handleAlertScan}
            onResolveAlert={handleMarkAlertRead}
            scoreColor={scoreColor}
          />
        )}

        {/* ═══════ TAB 2: REVIEW QUEUE ═══════ */}
        {activeTab === 'review' && (
          <ReviewQueueTab 
            pendingMaps={pendingMaps}
            bulkList={bulkList}
            toggleBulk={toggleBulk}
            onApproveMap={handleApproveMap}
            onRejectMap={handleRejectMap}
            onBulkApprove={handleBulkApprove}
            openDetailModal={openDetailModal}
            openEditModal={openEditModal}
          />
        )}

        {/* ═══════ TAB 3: DISPATCH TRACKER ═══════ */}
        {activeTab === 'tracker' && (
          <DispatchTrackerTab 
            activeDispatches={activeDispatches}
            openDetailModal={openDetailModal}
            scoreColor={scoreColor}
          />
        )}

        {/* ═══════ TAB 4: DEPARTMENT KANBAN BOARD ═══════ */}
        {activeTab === 'portal' && (
          <DepartmentBoardTab 
            selectedDeptId={selectedDeptId}
            setSelectedDeptId={setSelectedDeptId}
            departments={departments}
            deptMaps={deptMaps}
            openDetailModal={openDetailModal}
            openEvidenceModal={openEvidenceModal}
          />
        )}

        {/* ═══════ TAB 5: CIRCULAR INGEST ═══════ */}
        {activeTab === 'ingestion' && (
          <CircularIngestTab 
            manualRegulator={manualRegulator}
            setManualRegulator={setManualRegulator}
            manualType={manualType}
            setManualType={setManualType}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            uploadProgress={uploadProgress}
            scraperStatus={scraperStatus}
            onTriggerScraper={handleTriggerScraper}
            onUploadDocument={handleUploadDocument}
            documents={documents}
            pipelineProgress={pipelineProgress}
            onTriggerPipeline={handleTriggerPipeline}
            onDeleteDocument={handleDeleteDocument}
            BACKEND_URL={BACKEND_URL}
          />
        )}

        {/* ═══════ TAB 6: AGENT WORKBENCH ═══════ */}
        {activeTab === 'workbench' && (
          <AgentWorkbenchTab 
            activePipelineDocId={activePipelineDocId}
            workbenchStep={workbenchStep}
            draftMapsList={draftMapsList}
            setDraftMapsList={setDraftMapsList}
            executiveSummary={executiveSummary}
            riskScore={riskScore}
            conflictAlerts={conflictAlerts}
            generatedScripts={generatedScripts}
            departments={departments}
            documents={documents}
            handleSelectActiveDoc={handleSelectActiveDoc}
            handleConfirmMaps={handleConfirmMaps}
            handleConfirmRouting={handleConfirmRouting}
            handlePublishPipeline={handlePublishPipeline}
          />
        )}

      </div>

      {/* ═══════ DETAIL MODAL ═══════ */}
      {isDetailModalOpen && activeMap && (
        <DetailModal 
          activeMap={activeMap}
          onClose={() => setIsDetailModalOpen(false)}
          validationScript={validationScript}
          mapAuditLogs={mapAuditLogs}
          overrideVerdict={overrideVerdict}
          setOverrideVerdict={setOverrideVerdict}
          overrideReason={overrideReason}
          setOverrideReason={setOverrideReason}
          onOverrideValidation={handleOverrideValidation}
        />
      )}

      {/* ═══════ EVIDENCE UPLOAD MODAL ═══════ */}
      {isEvidenceModalOpen && activeMap && (
        <EvidenceModal 
          activeMap={activeMap}
          onClose={() => setIsEvidenceModalOpen(false)}
          evidenceType={evidenceType}
          setEvidenceType={setEvidenceType}
          evidenceFiles={evidenceFiles}
          setEvidenceFiles={setEvidenceFiles}
          evidenceNotes={evidenceNotes}
          setEvidenceNotes={setEvidenceNotes}
          onSubmitEvidence={handleSubmitEvidence}
        />
      )}

      {/* ═══════ EDIT CALIBRATION MODAL ═══════ */}
      {isEditModalOpen && activeMap && (
        <EditModal 
          activeMap={activeMap}
          onClose={() => setIsEditModalOpen(false)}
          editFields={editFields}
          setEditFields={setEditFields}
          departments={departments}
          onSubmitEdit={handleSubmitEdit}
        />
      )}

      {/* ═══════ ALL DOCUMENTS MODAL ═══════ */}
      {allDocsModalOpen && (
        <AllDocsModal 
          onClose={() => setAllDocsModalOpen(false)}
          documents={documents}
          pipelineProgress={pipelineProgress}
          onTriggerPipeline={handleTriggerPipeline}
          onDeleteDocument={handleDeleteDocument}
          BACKEND_URL={BACKEND_URL}
        />
      )}

      {/* ═══════ TOAST NOTIFICATION ═══════ */}
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

    </div>
  );
}

export default App;

