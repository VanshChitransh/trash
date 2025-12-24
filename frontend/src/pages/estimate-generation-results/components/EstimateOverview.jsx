import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';

const EstimateOverview = ({ estimateData }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  
  // Extract real data from estimateData - handle both items and issues formats
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
        rationale: item.rationale || ''
      }))
    : estimateIssuesLegacy;
  
  const extractionIssues = estimateData?.extractionData?.issues || [];
  const extractionSummary = estimateData?.extractionData?.summary || {};
  const estimateSummary = estimateData?.estimateData?.summary || {};
  
  // Get total cost from summary (new format uses total_usd)
  const totalCostFromSummary = estimateSummary?.total_usd || estimateSummary?.total_estimate || 0;

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
    const merged = [];
    
    if (estimateIssues.length > 0) {
      estimateIssues.forEach((estIssue, index) => {
        // Try to find matching extraction issue for more details
        const matchingExtraction = extractionIssues.find((extIssue) => {
          const estCategory = (estIssue.category || '').toLowerCase();
          const extSection = (extIssue.section || '').toLowerCase();
          const estDesc = (estIssue.description || estIssue.scope || '').toLowerCase();
          const extTitle = (extIssue.title || '').toLowerCase();
          const extDesc = (extIssue.description || '').toLowerCase();
          
          return estCategory.includes(extSection) || 
                 extSection.includes(estCategory) ||
                 estDesc.includes(extTitle) ||
                 extTitle.includes(estDesc.substring(0, 50)) ||
                 estDesc.includes(extDesc.substring(0, 50));
        });

        // Get cost - handle both formats
        const cost = estIssue.unit_price || estIssue.unit_price_usd || estIssue.line_total_usd || estIssue.cost || 0;
        
        merged.push({
          id: estIssue.id || `issue-${index}`,
          title: estIssue.scope || estIssue.description || matchingExtraction?.title || 'Issue',
          description: estIssue.description || estIssue.notes || matchingExtraction?.description || estIssue.scope || '',
          category: estIssue.category || matchingExtraction?.section || 'MISCELLANEOUS',
          priority: normalizeSeverity(estIssue.severity || matchingExtraction?.severity || 'moderate'),
          cost: cost,
          quantity: estIssue.quantity || estIssue.qty || 1,
          unit: estIssue.unit || '',
          location: estIssue.location || matchingExtraction?.location || '',
          materials: estIssue.materials || [],
          labor: estIssue.labor || 0,
          materialCost: estIssue.material_cost || 0,
          timeline: estIssue.timeline || '1-2 weeks',
          isDIY: estIssue.is_diy || false,
          urgency: estIssue.urgency || '',
          notes: estIssue.notes || matchingExtraction?.notes || estIssue.disclaimer || '',
          rationale: estIssue.rationale || '',
          disclaimer: estIssue.disclaimer || ''
        });
      });
    } else if (extractionIssues.length > 0) {
      // Fallback to extraction issues only
      extractionIssues.forEach((extIssue, index) => {
        merged.push({
          id: extIssue.id || `ext-${index}`,
          title: extIssue.title || 'Issue',
          description: extIssue.description || '',
          category: extIssue.section || 'MISCELLANEOUS',
          priority: normalizeSeverity(extIssue.severity),
          cost: 0,
          quantity: 1,
          unit: '',
          location: extIssue.location || '',
          materials: [],
          labor: 0,
          materialCost: 0,
          timeline: '1-2 weeks',
          isDIY: false,
          urgency: '',
          notes: extIssue.notes || '',
        });
      });
    }

    return merged;
  }, [estimateIssues, extractionIssues]);

  // Calculate category data from estimate issues/items
  const categoryData = useMemo(() => {
    const categoryMap = {};
    const colors = {
      'PLUMBING': '#3B82F6',
      'ELECTRICAL': '#10B981',
      'ROOFING': '#F59E0B',
      'ROOF': '#F59E0B',
      'HVAC': '#EF4444',
      'EXTERIOR': '#8B5CF6',
      'INTERIOR': '#EC4899',
      'WINDOWS/DOORS': '#06B6D4',
      'ATTIC': '#84CC16',
      'FOUNDATION': '#F97316',
      'MISCELLANEOUS': '#6B7280',
      'EVALUATE': '#9CA3AF',
      'EXCLUDED': '#D1D5DB',
    };

    if (estimateIssues.length > 0) {
      estimateIssues.forEach(issue => {
        const category = (issue.category || 'MISCELLANEOUS').toUpperCase();
        // Handle both unit_price (legacy) and unit_price_usd/line_total_usd (new format)
        const price = issue.unit_price || issue.unit_price_usd || issue.line_total_usd || 0;
        if (!categoryMap[category]) {
          categoryMap[category] = {
            name: category.replace(/_/g, ' ').replace(/\//g, '/'),
            value: 0,
            color: colors[category] || colors['MISCELLANEOUS']
          };
        }
        categoryMap[category].value += price;
      });
    }

    return Object.values(categoryMap).sort((a, b) => b.value - a.value);
  }, [estimateIssues]);

  // Calculate priority/severity data
  const priorityData = useMemo(() => {
    const severityMap = {
      'Critical': { count: 0, cost: 0, color: '#EF4444' },
      'High': { count: 0, cost: 0, color: '#F59E0B' },
      'Medium': { count: 0, cost: 0, color: '#10B981' },
      'Low': { count: 0, cost: 0, color: '#6B7280' }
    };

    // Count from extraction issues (they have severity)
    extractionIssues.forEach(issue => {
      const severity = normalizeSeverity(issue.severity);
      if (severityMap[severity]) {
        severityMap[severity].count += 1;
      }
    });

    // Calculate costs from estimate issues/items
    // Try to match estimate items with extraction issues by category/description
    estimateIssues.forEach((estIssue, index) => {
      // Try to find matching extraction issue to get severity
      const matchingExtraction = extractionIssues.find((extIssue) => {
        const estCategory = (estIssue.category || '').toLowerCase();
        const extSection = (extIssue.section || '').toLowerCase();
        const estDesc = (estIssue.description || estIssue.scope || '').toLowerCase();
        const extTitle = (extIssue.title || '').toLowerCase();
        return estCategory.includes(extSection) || 
               extSection.includes(estCategory) ||
               estDesc.includes(extTitle) ||
               extTitle.includes(estDesc.substring(0, 50));
      });
      
      const severity = matchingExtraction 
        ? normalizeSeverity(matchingExtraction.severity)
        : normalizeSeverity(estIssue.severity) || 'Medium'; // Default to Medium if no severity
      
      const price = estIssue.unit_price || estIssue.unit_price_usd || estIssue.line_total_usd || 0;
      if (severityMap[severity]) {
        severityMap[severity].cost += price;
        // Only increment count if we matched with extraction issue (to avoid double counting)
        if (matchingExtraction) {
          // Count is already incremented from extraction issues
        }
      }
    });

    return Object.entries(severityMap).map(([priority, data]) => ({
      priority,
      ...data
    }));
  }, [estimateIssues, extractionIssues]);

  const totalCost = totalCostFromSummary || estimateSummary?.total_estimate || estimateData?.totalCost || 0;
  const totalIssues = extractionSummary?.total_issues || extractionIssues.length || estimateIssues.length || 0;
  const criticalCount = priorityData.find(p => p.priority === 'Critical')?.count || 0;
  
  // Get totals by severity from extraction summary
  const totalsBySeverity = extractionSummary?.totals_by_severity || [];
  const criticalIssues = totalsBySeverity.find(s => 
    s.severity?.toLowerCase().includes('critical') || 
    s.severity?.toLowerCase().includes('safety')
  )?.count || criticalCount;
  

  const handleCategoryClick = (category) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
    setSelectedPriority(null);
  };

  const handlePriorityClick = (priority) => {
    if (selectedPriority === priority) {
      setSelectedPriority(null);
    } else {
      setSelectedPriority(priority);
    }
    setSelectedCategory(null);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-moderate">
          <p className="text-sm font-medium text-foreground">{`${label}: $${payload?.[0]?.value?.toLocaleString()}`}</p>
          <p className="text-xs text-muted-foreground mt-1">Click to filter</p>
        </div>
      );
    }
    return null;
  };

  const priorityColors = {
    'Critical': 'text-error bg-error/10 border-error/20',
    'High': 'text-warning bg-warning/10 border-warning/20',
    'Medium': 'text-accent bg-accent/10 border-accent/20',
    'Low': 'text-muted-foreground bg-muted border-border'
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="DollarSign" size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Estimate</p>
              <p className="text-xl font-semibold text-foreground">
                ${typeof totalCost === 'number' ? totalCost.toLocaleString() : '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-error/10 rounded-lg">
              <Icon name="AlertTriangle" size={20} className="text-error" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-xl font-semibold text-foreground">{criticalIssues}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon name="Clock" size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Timeline</p>
              <p className="text-xl font-semibold text-foreground">6-8 weeks</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Icon name="TrendingUp" size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market Rate</p>
              <p className="text-xl font-semibold text-foreground">Fair</p>
            </div>
          </div>
        </div>
      </div>
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Category */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Cost by Category</h3>
          {categoryData.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                        if (percent < 0.02) return '';
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        const chartPadding = outerRadius + 20;
                        const minX = cx - chartPadding;
                        const maxX = cx + chartPadding;
                        const minY = cy - chartPadding;
                        const maxY = cy + chartPadding;
                        const safePadding = 12;
                        const adjustedX = Math.max(minX + safePadding, Math.min(x, maxX - safePadding));
                        const adjustedY = Math.max(minY + safePadding, Math.min(y, maxY - safePadding));
                        const isRightSide = x > cx;
                        const textAnchor = isRightSide ? 'start' : 'end';
                        return (
                          <text
                            x={adjustedX}
                            y={adjustedY}
                            fill="#1F2937"
                            textAnchor={textAnchor}
                            dominantBaseline="central"
                            fontSize={13}
                            fontWeight={600}
                            style={{ 
                              pointerEvents: 'none',
                              textShadow: '0 0 3px rgba(255, 255, 255, 0.9), 0 0 3px rgba(255, 255, 255, 0.9)'
                            }}
                          >
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                      onClick={(data, index, e) => {
                        if (data && data.name) {
                          handleCategoryClick(data.name);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        if (e && e.target) {
                          e.target.style.cursor = 'pointer';
                        }
                      }}
                    >
                      {categoryData?.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry?.color}
                          onClick={() => handleCategoryClick(entry.name)}
                          style={{
                            cursor: 'pointer',
                            opacity: selectedCategory && selectedCategory !== entry.name ? 0.3 : 1,
                            transition: 'opacity 0.2s'
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {categoryData?.slice(0, 6).map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-smooth cursor-pointer ${
                      selectedCategory === item.name ? 'bg-primary/10 border border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleCategoryClick(item.name)}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item?.color }}
                    ></div>
                    <span className="text-sm text-muted-foreground truncate flex-1">{item?.name}</span>
                    <span className="text-sm font-medium text-foreground">
                      ${Math.round(item?.value || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {selectedCategory && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Filtering by: <span className="font-medium text-foreground">{selectedCategory}</span>
                  </span>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No category data available
            </div>
          )}
        </div>

        {/* Priority Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Issues by Priority</h3>
          {priorityData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="priority" 
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-moderate">
                              <p className="text-sm font-medium text-foreground">{data.priority}</p>
                              <p className="text-xs text-muted-foreground">Count: {data.count}</p>
                              <p className="text-sm font-medium text-foreground">
                                Cost: ${Math.round(data.cost || 0).toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  <Bar 
                    dataKey="cost" 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (data && data.priority) {
                        handlePriorityClick(data.priority);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                      {priorityData?.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry?.color}
                        onClick={() => handlePriorityClick(entry.priority)}
                        style={{
                          cursor: 'pointer',
                          opacity: selectedPriority && selectedPriority !== entry.priority ? 0.3 : 1,
                          transition: 'opacity 0.2s'
                        }}
                      />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No priority data available
            </div>
          )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {priorityData?.map((item, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-2 rounded-lg transition-smooth cursor-pointer ${
                  selectedPriority === item.priority 
                    ? 'bg-primary/10 border border-primary' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => handlePriorityClick(item.priority)}
              >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item?.color }}
                      ></div>
                      <span className="text-sm text-muted-foreground">{item?.priority}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{item?.count} issues</p>
                      <p className="text-xs text-muted-foreground">${Math.round(item?.cost || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
          {selectedPriority && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Filtering by: <span className="font-medium text-foreground">{selectedPriority}</span>
              </span>
              <button
                onClick={() => setSelectedPriority(null)}
                className="text-xs text-primary hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Quick Stats */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Icon name="FileText" size={20} className="text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Issues</p>
              <p className="font-medium text-foreground">{totalIssues} issues found</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Icon name="MapPin" size={20} className="text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium text-foreground">
                {estimateData?.extractionData?.metadata?.property_address || 
                 estimateData?.extraction?.metadata?.property_address || 
                 estimateData?.extractionData?.metadata?.address || 
                 estimateData?.extraction?.metadata?.address || 
                 estimateSummary?.address || 
                 estimateSummary?.property_address || 
                 'Houston, TX'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <Icon name="TrendingUp" size={20} className="text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Average per Issue</p>
              <p className="font-medium text-foreground">
                ${totalIssues > 0 ? Math.round(totalCost / totalIssues).toLocaleString() : '0'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimateOverview;