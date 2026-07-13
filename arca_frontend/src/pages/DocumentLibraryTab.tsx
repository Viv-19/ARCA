import React, { useState, useMemo } from 'react';
import type { Document } from '../types';
import { ProcessingProgress } from '../components/ProcessingProgress';
import { DocumentLibraryDetailModal } from '../components/DocumentLibraryDetailModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import './DocumentLibraryTab.css';

interface Props {
  documents: Document[];
  pipelineProgress: any;
  onDeleteDocument: (docId: string) => void;
  onTriggerPipeline: (docId: string) => void;
  BACKEND_URL: string;
}

// Normalise field names across AI-registry (snake_case) and Prisma (camelCase) docs
const getCircularNumber = (doc: Document) => doc.circular_number || doc.documentId || 'N/A';
const getPublicationDate = (doc: Document) => doc.publication_date || doc.publicationDate || null;
const getDomain = (doc: Document) => doc.department || doc.regulator || '';
const getPdfUrlForDoc = (doc: Document, BACKEND_URL: string) => {
  if (doc.pdfUrl && doc.pdfUrl.startsWith('http')) return doc.pdfUrl;
  if (doc.detail_url && doc.detail_url.startsWith('http')) return doc.detail_url;
  if (doc.detail_url && doc.detail_url.startsWith('/api')) return `${BACKEND_URL}${doc.detail_url}`;
  return `${BACKEND_URL}/api/documents/${doc.id}/file`;
};

export const DocumentLibraryTab: React.FC<Props> = ({
  documents,
  pipelineProgress,
  onDeleteDocument,
  onTriggerPipeline,
  BACKEND_URL
}) => {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('ALL');
  const [filterDomain, setFilterDomain] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);

  // Top Statistics
  const stats = useMemo(() => {
    const total = documents.length;
    let processed = 0;
    let pendingAi = 0;
    let failed = 0;

    documents.forEach(doc => {
      const s = doc.status.toUpperCase();
      if (s === 'FAILED') {
        failed++;
      } else if (s === 'PROCESSED') {
        pendingAi++;
        processed++;
      } else if (s === 'MAP_GENERATED' || s === 'COMPLETED' || s === 'DRAFT_MAPS_GENERATED' || s === 'DRAFT_MAPS_ROUTED' || s === 'DRAFT_PIPELINE_FINALIZED') {
        processed++;
      }
    });

    return { total, processed, pendingAi, failed };
  }, [documents]);

  // Derive unique domains for the filter dropdown
  const uniqueDomains = useMemo(() => {
    const domains = new Set(documents.map(d => getDomain(d)).filter(Boolean));
    return ['ALL', ...Array.from(domains)];
  }, [documents]);

  // Filtering Logic
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      let matchesSearch = true;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const circNum = getCircularNumber(doc).toLowerCase();
        const domain = getDomain(doc).toLowerCase();
        const pubDate = getPublicationDate(doc) || '';

        switch (searchField) {
          case 'RBI Number':
            matchesSearch = circNum.includes(term);
            break;
          case 'Title':
            matchesSearch = !!doc.title?.toLowerCase().includes(term);
            break;
          case 'Business Domain':
            matchesSearch = domain.includes(term);
            break;
          case 'Keywords':
            matchesSearch = !!doc.title?.toLowerCase().includes(term) || domain.includes(term);
            break;
          case 'Publication Date':
            matchesSearch = pubDate.includes(term);
            break;
          default:
            matchesSearch =
              !!doc.title?.toLowerCase().includes(term) ||
              circNum.includes(term) ||
              domain.includes(term) ||
              pubDate.includes(term);
            break;
        }
      }

      const matchesDomain = filterDomain === 'ALL' || getDomain(doc) === filterDomain;
      
      let matchesStatus = true;
      if (filterStatus !== 'ALL') {
        matchesStatus = doc.status.toUpperCase() === filterStatus;
      }

      return matchesSearch && matchesDomain && matchesStatus;
    });
  }, [documents, searchTerm, searchField, filterDomain, filterStatus]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage) || 1;
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDocs.slice(start, start + itemsPerPage);
  }, [filteredDocs, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDomain, filterStatus]);



  return (
    <div className="doc-library-container">
      
      {/* 1. Top Statistics (Executive Panel) */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-blue">{stats.processed}</div>
          <div className="stat-label">Processed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-purple">{stats.pendingAi}</div>
          <div className="stat-label">Pending AI</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
      </div>

      {/* 2. Search & Filters */}
      <div className="filters-row">
        <div className="search-box">
          <select 
            className="search-field-select"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
          >
            <option value="ALL">All Fields</option>
            <option value="RBI Number">RBI Number</option>
            <option value="Title">Title</option>
            <option value="Business Domain">Business Domain</option>
            <option value="Keywords">Keywords</option>
            <option value="Publication Date">Publication Date</option>
          </select>
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder={`Search ${searchField === 'ALL' ? '...' : `by ${searchField}...`}`} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
          {uniqueDomains.map(d => (
            <option key={d} value={d}>{d === 'ALL' ? 'All Domains' : d}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="NEW">NEW</option>
          <option value="CLASSIFIED">CLASSIFIED</option>
          <option value="DOWNLOADED">DOWNLOADED</option>
          <option value="PROCESSED">PROCESSED</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      {/* 3. Main Table */}
      <div className="table-container">
        <table className="library-table">
          <thead>
            <tr>
              <th>Circular</th>
              <th style={{ width: '25%' }}>Title</th>
              <th>Date</th>
              <th>Status</th>
              <th style={{ width: '20%' }}>Processing Progress</th>
              <th style={{ width: '25%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">No documents match your filters.</td>
              </tr>
            ) : (
              paginatedDocs.map(doc => (
                <tr key={doc.id}>
                  <td><strong>{getCircularNumber(doc)}</strong></td>
                  <td className="truncate-text" title={doc.title}>{doc.title}</td>
                  <td>{getPublicationDate(doc) ? new Date(getPublicationDate(doc)!).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <span className={`badge status-${doc.status.toLowerCase()}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td>
                    <div className="mini-progress-wrapper">
                       {/* We could use a mini version of ProcessingProgress or just the text, but the user wanted the list. Since the table cell is small, we'll render a simplified vertical list or use the component */}
                       <ProcessingProgress status={doc.status} pipelineProgress={pipelineProgress} />
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view-btn" onClick={() => setDetailDoc(doc)}>
                        👁 Details
                      </button>
                      <a 
                        className="action-btn pdf-btn" 
                        href={getPdfUrlForDoc(doc, BACKEND_URL)} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        📄 PDF
                      </a>
                      <button
                        className="action-btn ai-btn"
                        onClick={() => onTriggerPipeline(doc.id)}
                        disabled={doc.status === 'PROCESSING_STAGE1' || doc.status === 'PROCESSING_STAGE2' || doc.status === 'PROCESSING_STAGE3'}
                        title={doc.status === 'PROCESSED' ? 'Already published — open to review' : 'Open in AI Workbench'}
                      >
                        🤖 AI Workbench
                      </button>
                      <button className="action-btn delete-btn" onClick={() => setDeleteDoc(doc)}>
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={currentPage === 1} 
            onClick={() => handlePageChange(currentPage - 1)}
          >
            &lt; Previous
          </button>
          
          <span className="page-info">Page {currentPage} of {totalPages}</span>
          
          <button 
            disabled={currentPage === totalPages} 
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next &gt;
          </button>
        </div>
      )}

      {/* Modals */}
      {detailDoc && (
        <DocumentLibraryDetailModal
          document={detailDoc}
          pipelineProgress={pipelineProgress}
          onClose={() => setDetailDoc(null)}
          BACKEND_URL={BACKEND_URL}
        />
      )}

      {deleteDoc && (
        <DeleteConfirmModal
          docId={deleteDoc.id}
          docTitle={deleteDoc.title}
          onCancel={() => setDeleteDoc(null)}
          onConfirm={(id) => {
            onDeleteDocument(id);
            setDeleteDoc(null);
          }}
        />
      )}

    </div>
  );
};
