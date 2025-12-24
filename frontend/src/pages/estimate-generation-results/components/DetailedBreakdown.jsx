import React, { useState, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DetailedBreakdown = ({ estimateData }) => {
  const [sortBy, setSortBy] = useState('priority');
  const [filterBy, setFilterBy] = useState('all');
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Extract data from estimateData prop - handle both items and issues formats
  const estimateItems = estimateData?.estimateData?.items || [];
  const estimateIssuesLegacy = estimateData?.estimateData?.issues || [];
  // Convert items to issues format for compatibility
  const estimateIssues = estimateItems.length > 0 
    ? estimateItems.map((item, index) => ({
        id: item.id || `item-${index}`,
        category: item.category || 'MISCELLANEOUS',
        unit_price: item.unit_price_usd || item.line_total_usd || 0,
        scope: item.description || '',
        description: item.description || '',
        notes: item.notes || '',
        quantity: item.qty || 1,
        unit: item.unit || '',
        severity: 'moderate', // Default since items don't have severity
        disclaimer: item.disclaimer || '',
        rationale: item.rationale || '',
        cost: {
          min_cost: item.unit_price_usd ? item.unit_price_usd * 0.8 : 0,
          max_cost: item.unit_price_usd ? item.unit_price_usd * 1.2 : 0
        }
      }))
    : estimateIssuesLegacy;
  
  const extractionIssues = estimateData?.extractionData?.issues || [];

  // Map severity levels to standard format
  const normalizeSeverity = (severity) => {
    if (!severity) return 'Low';
    const s = severity.toLowerCase();
    if (s.includes('critical') || s.includes('safety') || s === 'critical') return 'Critical';
    if (s.includes('major') || s.includes('deficient') || s === 'major' || s === 'high') return 'High';
    if (s.includes('moderate') || s.includes('minor') || s === 'moderate' || s === 'medium') return 'Medium';
    return 'Low';
  };

  // Merge extraction and estimate data to create complete issue objects
  const mergedIssues = useMemo(() => {
    // Create a map of estimate issues by ID or index
    const estimateMap = new Map();
    estimateIssues.forEach((issue, index) => {
      const key = issue.id || `est-${index}`;
      estimateMap.set(key, issue);
    });

    // Create merged issues
    const merged = [];
    
    // If we have estimate issues, use them as primary source
    if (estimateIssues.length > 0) {
      estimateIssues.forEach((estIssue, index) => {
        // Try to find matching extraction issue
        const matchingExtraction = extractionIssues.find((extIssue, extIndex) => {
          // Match by similar category, severity, or description
          const estCategory = (estIssue.category || '').toLowerCase();
          const extSection = (extIssue.section || '').toLowerCase();
          const estScope = (estIssue.scope || '').toLowerCase();
          const extTitle = (extIssue.title || '').toLowerCase();
          const extDesc = (extIssue.description || '').toLowerCase();
          
          return estCategory.includes(extSection) || 
                 extSection.includes(estCategory) ||
                 estScope.includes(extTitle) ||
                 extTitle.includes(estScope) ||
                 estScope.includes(extDesc.substring(0, 50));
        }) || extractionIssues[index] || {};

        const severity = normalizeSeverity(estIssue.severity || matchingExtraction.severity || 'moderate');
        const category = estIssue.category || matchingExtraction.section || 'MISCELLANEOUS';
        const title = estIssue.scope || estIssue.description || matchingExtraction.title || `Issue ${index + 1}`;
        const description = matchingExtraction.description || estIssue.description || estIssue.notes || estIssue.rationale || estIssue.scope || '';
        // Handle both unit_price (legacy) and unit_price_usd/line_total_usd (new format)
        const cost = estIssue.unit_price || estIssue.unit_price_usd || estIssue.line_total_usd || 0;
        const costInfo = estIssue.cost || {};
        
        merged.push({
          id: estIssue.id || `issue-${index}`,
          title: title.length > 100 ? title.substring(0, 100) + '...' : title,
          category: category.replace(/_/g, ' ').replace(/\//g, '/'),
          priority: severity,
          cost: cost,
          minCost: costInfo.min_cost || cost * 0.8,
          maxCost: costInfo.max_cost || cost * 1.2,
          description: description,
          rationale: estIssue.rationale || '',
          disclaimer: estIssue.disclaimer || 'Estimate based on Houston market averages.',
          section: matchingExtraction.section || '',
          estimatedFix: matchingExtraction.estimated_fix || '',
          pageRefs: matchingExtraction.page_refs || [],
          scope: estIssue.scope || '',
          isEvaluation: cost === 0 || severity === 'Low',
        });
      });
    } else if (extractionIssues.length > 0) {
      // Fallback to extraction issues if no estimate issues
      extractionIssues.forEach((extIssue, index) => {
        const severity = normalizeSeverity(extIssue.severity);
        merged.push({
          id: extIssue.id || `issue-${index}`,
          title: extIssue.title || `Issue ${index + 1}`,
          category: extIssue.section || 'MISCELLANEOUS',
          priority: severity,
          cost: 0,
          description: extIssue.description || '',
          section: extIssue.section || '',
          estimatedFix: extIssue.estimated_fix || '',
          pageRefs: extIssue.page_refs || [],
          isEvaluation: true,
        });
      });
    }

    return merged;
  }, [estimateIssues, extractionIssues]);

  const mockIssues = [
    {
      id: 1,
      title: 'Main Water Line Leak',
      category: 'Plumbing',
      priority: 'Critical',
      cost: 2800,
      timeline: '1-2 days',
      description: 'Major leak detected in main water supply line requiring immediate attention to prevent water damage.',
      isDIY: false,
      seasonalTiming: 'Any time',
      materials: ['PVC pipe', 'Fittings', 'Sealant'],
      labor: 1800,
      materialCost: 1000,
      urgency: 'Immediate',
      marketRate: 'Fair',
      preventionTips: 'Regular inspection of water lines, monitor water pressure'
    },
    {
      id: 2,
      title: 'Electrical Panel Upgrade',
      category: 'Electrical',
      priority: 'High',
      cost: 3200,
      timeline: '2-3 days',
      description: 'Outdated electrical panel needs replacement to meet current safety standards.',
      isDIY: false,
      seasonalTiming: 'Any time',
      materials: ['200A panel', 'Circuit breakers', 'Wiring'],
      labor: 2000,
      materialCost: 1200,
      urgency: 'Within 30 days',
      marketRate: 'Good',
      preventionTips: 'Annual electrical inspections, avoid overloading circuits'
    },
    {
      id: 3,
      title: 'Roof Shingle Replacement',
      category: 'Roofing',
      priority: 'Medium',
      cost: 4200,
      timeline: '3-5 days',
      description: 'Several damaged shingles need replacement to prevent water infiltration.',
      isDIY: true,
      seasonalTiming: 'Spring/Summer',
      materials: ['Asphalt shingles', 'Underlayment', 'Nails'],
      labor: 2500,
      materialCost: 1700,
      urgency: 'Within 60 days',
      marketRate: 'Fair',
      preventionTips: 'Regular roof inspections, clean gutters, trim overhanging branches'
    },
    {
      id: 4,
      title: 'HVAC Filter Replacement',
      category: 'HVAC',
      priority: 'Low',
      cost: 150,
      timeline: '1 hour',
      description: 'Air filters need replacement for optimal system performance.',
      isDIY: true,
      seasonalTiming: 'Any time',
      materials: ['HVAC filters'],
      labor: 50,
      materialCost: 100,
      urgency: 'Within 90 days',
      marketRate: 'Good',
      preventionTips: 'Replace filters every 3 months, check system regularly'
    },
    {
      id: 5,
      title: 'Foundation Crack Repair',
      category: 'Structural',
      priority: 'High',
      cost: 1800,
      timeline: '1-2 days',
      description: 'Minor foundation cracks require sealing to prevent water intrusion.',
      isDIY: false,
      seasonalTiming: 'Spring/Fall',
      materials: ['Hydraulic cement', 'Sealant', 'Waterproofing'],
      labor: 1200,
      materialCost: 600,
      urgency: 'Within 45 days',
      marketRate: 'Fair',
      preventionTips: 'Proper drainage, monitor for new cracks, maintain consistent moisture levels'
    }
  ];

  const priorityColors = {
    'Critical': 'text-error bg-error/10 border-error/20',
    'High': 'text-warning bg-warning/10 border-warning/20',
    'Medium': 'text-accent bg-accent/10 border-accent/20',
    'Low': 'text-muted-foreground bg-muted border-border'
  };

  const categoryIcons = {
    'Plumbing': 'Droplets',
    'PLUMBING': 'Droplets',
    'Electrical': 'Zap',
    'ELECTRICAL': 'Zap',
    'Roofing': 'Home',
    'ROOFING': 'Home',
    'HVAC': 'Wind',
    'Exterior': 'Home',
    'EXTERIOR': 'Home',
    'Interior': 'Layout',
    'INTERIOR': 'Layout',
    'Windows/Doors': 'Window',
    'WINDOWS/DOORS': 'Window',
    'Attic': 'Home',
    'ATTIC': 'Home',
    'Structural': 'Building',
    'Miscellaneous': 'Package',
    'MISCELLANEOUS': 'Package',
    'Evaluate': 'Search',
    'EVALUATE': 'Search',
  };

  const getCategoryIcon = (category) => {
    return categoryIcons[category] || categoryIcons[category.toUpperCase()] || 'FileText';
  };

  // Use merged issues instead of mock issues
  const issuesToDisplay = mergedIssues.length > 0 ? mergedIssues : mockIssues;

  const sortedIssues = [...issuesToDisplay]?.sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return (priorityOrder?.[a?.priority] ?? 4) - (priorityOrder?.[b?.priority] ?? 4);
    }
    if (sortBy === 'cost') return (b?.cost || 0) - (a?.cost || 0);
    if (sortBy === 'category') return (a?.category || '').localeCompare(b?.category || '');
    return 0;
  });

  const filteredIssues = sortedIssues?.filter(issue => {
    if (filterBy === 'all') return true;
    return issue?.priority?.toLowerCase() === filterBy.toLowerCase();
  });

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded?.has(id)) {
      newExpanded?.delete(id);
    } else {
      newExpanded?.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Sorting */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">Filter by:</span>
            {['all', 'critical', 'high', 'medium', 'low']?.map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterBy(filter)}
                className={`px-3 py-1 text-xs rounded-full transition-smooth capitalize ${
                  filterBy === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {filter === 'all' ? 'All Issues' : filter}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e?.target?.value)}
              className="px-3 py-1 text-sm border border-border rounded-md bg-background text-foreground"
            >
              <option value="priority">Priority</option>
              <option value="cost">Cost</option>
              <option value="category">Category</option>
            </select>
          </div>
        </div>
      </div>
      {/* Issues List */}
      <div className="space-y-4">
        {filteredIssues?.map((issue) => (
          <div key={issue?.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon name={getCategoryIcon(issue?.category)} size={20} className="text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground">{issue?.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full border ${priorityColors?.[issue?.priority] || priorityColors['Low']}`}>
                        {issue?.priority}
                      </span>
                      {issue?.isEvaluation && (
                        <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                          Evaluation Needed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {issue?.description || issue?.scope || 'No description available'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Icon name="Tag" size={14} />
                        <span>{issue?.category}</span>
                      </span>
                      {issue?.section && (
                        <span className="flex items-center space-x-1">
                          <Icon name="FileText" size={14} />
                          <span>{issue.section}</span>
                        </span>
                      )}
                      {issue?.pageRefs && issue.pageRefs.length > 0 && (
                        <span className="flex items-center space-x-1">
                          <Icon name="File" size={14} />
                          <span>Pages: {issue.pageRefs.join(', ')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  {issue?.cost > 0 ? (
                    <>
                      <p className="text-xl font-semibold text-foreground">${Math.round(issue?.cost || 0).toLocaleString()}</p>
                      {issue?.minCost && issue?.maxCost && issue.minCost !== issue.maxCost && (
                        <p className="text-xs text-muted-foreground">
                          ${Math.round(issue.minCost).toLocaleString()} - ${Math.round(issue.maxCost).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Evaluation needed</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {issue?.rationale && (
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Icon name="Info" size={14} />
                      <span className="max-w-md truncate">{issue.rationale.substring(0, 50)}...</span>
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(issue?.id)}
                  iconName={expandedItems?.has(issue?.id) ? "ChevronUp" : "ChevronDown"}
                  iconPosition="right"
                >
                  {expandedItems?.has(issue?.id) ? 'Less Details' : 'More Details'}
                </Button>
              </div>
            </div>

            {expandedItems?.has(issue?.id) && (
              <div className="border-t border-border p-4 bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-foreground mb-3">Cost Breakdown</h4>
                    <div className="space-y-2">
                      {issue?.cost > 0 ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Estimated Cost:</span>
                            <span className="text-foreground">${Math.round(issue?.cost || 0).toLocaleString()}</span>
                          </div>
                          {issue?.minCost && issue?.maxCost && issue.minCost !== issue.maxCost && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Min Cost:</span>
                                <span className="text-foreground">${Math.round(issue.minCost).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Max Cost:</span>
                                <span className="text-foreground">${Math.round(issue.maxCost).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
                            <span className="text-foreground">Total Estimate:</span>
                            <span className="text-foreground">${Math.round(issue?.cost || 0).toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          This issue requires evaluation before cost estimation.
                        </div>
                      )}
                    </div>
                    
                    {issue?.estimatedFix && (
                      <>
                        <h4 className="font-medium text-foreground mb-2 mt-4">Recommended Fix</h4>
                        <p className="text-sm text-muted-foreground">{issue.estimatedFix}</p>
                      </>
                    )}

                    {issue?.pageRefs && issue.pageRefs.length > 0 && (
                      <>
                        <h4 className="font-medium text-foreground mb-2 mt-4">Page References</h4>
                        <div className="flex flex-wrap gap-2">
                          {issue.pageRefs.map((page, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-muted rounded">
                              Page {page}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div>
                    {issue?.rationale && (
                      <>
                        <h4 className="font-medium text-foreground mb-3">Pricing Rationale</h4>
                        <p className="text-sm text-muted-foreground mb-4">{issue.rationale}</p>
                      </>
                    )}
                    
                    {issue?.scope && issue.scope !== issue.title && (
                      <>
                        <h4 className="font-medium text-foreground mb-3">Scope</h4>
                        <p className="text-sm text-muted-foreground mb-4">{issue.scope}</p>
                      </>
                    )}

                    {issue?.section && (
                      <>
                        <h4 className="font-medium text-foreground mb-3">Section</h4>
                        <p className="text-sm text-muted-foreground mb-4">{issue.section}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {filteredIssues?.length === 0 && (
        <div className="text-center py-8">
          <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No issues found matching your filters</p>
        </div>
      )}
    </div>
  );
};

export default DetailedBreakdown;
