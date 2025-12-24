import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CostCalculator = ({ onCalculate }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [customQuantities, setCustomQuantities] = useState({});
  const [materialOptions, setMaterialOptions] = useState({});

  const calculatorItems = [
    {
      id: 1,
      title: 'Main Water Line Repair',
      category: 'Plumbing',
      baseCost: 2800,
      unit: 'linear foot',
      defaultQuantity: 20,
      materials: [
        { name: 'Standard PVC', multiplier: 1.0, description: 'Basic PVC piping' },
        { name: 'Copper', multiplier: 1.8, description: 'Premium copper piping' },
        { name: 'PEX', multiplier: 1.3, description: 'Flexible PEX tubing' }
      ],
      laborRate: 85,
      complexity: 'High'
    },
    {
      id: 2,
      title: 'Electrical Panel Upgrade',
      category: 'Electrical',
      baseCost: 3200,
      unit: 'panel',
      defaultQuantity: 1,
      materials: [
        { name: '200A Standard', multiplier: 1.0, description: 'Standard 200A panel' },
        { name: '200A Smart', multiplier: 1.4, description: 'Smart panel with monitoring' },
        { name: '400A Commercial', multiplier: 2.2, description: 'Heavy-duty commercial panel' }
      ],
      laborRate: 125,
      complexity: 'High'
    },
    {
      id: 3,
      title: 'Roof Shingle Replacement',
      category: 'Roofing',
      baseCost: 4200,
      unit: 'square foot',
      defaultQuantity: 1200,
      materials: [
        { name: 'Asphalt Shingles', multiplier: 1.0, description: 'Standard 3-tab shingles' },
        { name: 'Architectural Shingles', multiplier: 1.3, description: 'Premium dimensional shingles' },
        { name: 'Metal Roofing', multiplier: 2.1, description: 'Durable metal roofing system' }
      ],
      laborRate: 65,
      complexity: 'Medium'
    },
    {
      id: 4,
      title: 'Foundation Crack Repair',
      category: 'Structural',
      baseCost: 1800,
      unit: 'linear foot',
      defaultQuantity: 15,
      materials: [
        { name: 'Hydraulic Cement', multiplier: 1.0, description: 'Basic crack sealing' },
        { name: 'Epoxy Injection', multiplier: 1.6, description: 'Professional epoxy system' },
        { name: 'Polyurethane', multiplier: 1.4, description: 'Flexible polyurethane sealant' }
      ],
      laborRate: 95,
      complexity: 'Medium'
    }
  ];

  const toggleItem = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev?.[itemId]
    }));
    
    if (!customQuantities?.[itemId]) {
      const item = calculatorItems?.find(i => i?.id === itemId);
      setCustomQuantities(prev => ({
        ...prev,
        [itemId]: item?.defaultQuantity
      }));
    }
    
    if (!materialOptions?.[itemId]) {
      setMaterialOptions(prev => ({
        ...prev,
        [itemId]: 0
      }));
    }
  };

  const updateQuantity = (itemId, quantity) => {
    setCustomQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, quantity)
    }));
  };

  const updateMaterial = (itemId, materialIndex) => {
    setMaterialOptions(prev => ({
      ...prev,
      [itemId]: materialIndex
    }));
  };

  const calculateItemCost = (item) => {
    if (!selectedItems?.[item?.id]) return 0;
    
    const quantity = customQuantities?.[item?.id] || item?.defaultQuantity;
    const materialIndex = materialOptions?.[item?.id] || 0;
    const material = item?.materials?.[materialIndex];
    
    const baseCostPerUnit = item?.baseCost / item?.defaultQuantity;
    const adjustedCost = baseCostPerUnit * material?.multiplier * quantity;
    
    return Math.round(adjustedCost);
  };

  const getTotalCost = () => {
    return calculatorItems?.reduce((total, item) => total + calculateItemCost(item), 0);
  };

  const getSelectedCount = () => {
    return Object.values(selectedItems)?.filter(Boolean)?.length;
  };

  const categoryIcons = {
    'Plumbing': 'Droplets',
    'Electrical': 'Zap',
    'Roofing': 'Home',
    'Structural': 'Building'
  };

  const complexityColors = {
    'High': 'text-error bg-error/10',
    'Medium': 'text-warning bg-warning/10',
    'Low': 'text-accent bg-accent/10'
  };

  return (
    <div className="space-y-6">
      {/* Calculator Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Cost Calculator</h2>
            <p className="text-muted-foreground">Customize quantities and materials for accurate estimates</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">${getTotalCost()?.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{getSelectedCount()} items selected</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2 px-3 py-1 bg-muted/50 rounded-full">
            <Icon name="Calculator" size={14} />
            <span className="text-sm text-muted-foreground">Real-time calculations</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-muted/50 rounded-full">
            <Icon name="TrendingUp" size={14} />
            <span className="text-sm text-muted-foreground">Market-based pricing</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-muted/50 rounded-full">
            <Icon name="Settings" size={14} />
            <span className="text-sm text-muted-foreground">Customizable options</span>
          </div>
        </div>
      </div>
      {/* Calculator Items */}
      <div className="space-y-4">
        {calculatorItems?.map((item) => (
          <div
            key={item?.id}
            className={`bg-card border rounded-lg transition-smooth ${
              selectedItems?.[item?.id] ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedItems?.[item?.id] || false}
                      onChange={() => toggleItem(item?.id)}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Icon name={categoryIcons?.[item?.category]} size={16} className="text-primary" />
                      <h3 className="font-semibold text-foreground">{item?.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${complexityColors?.[item?.complexity]}`}>
                        {item?.complexity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item?.category}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    ${calculateItemCost(item)?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${item?.laborRate}/hr labor
                  </p>
                </div>
              </div>

              {selectedItems?.[item?.id] && (
                <div className="border-t border-border pt-4 space-y-4">
                  {/* Quantity Adjustment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Quantity ({item?.unit})
                      </label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item?.id, (customQuantities?.[item?.id] || item?.defaultQuantity) - 1)}
                          className="p-2 border border-border rounded-md hover:bg-muted transition-smooth"
                        >
                          <Icon name="Minus" size={16} />
                        </button>
                        <input
                          type="number"
                          value={customQuantities?.[item?.id] || item?.defaultQuantity}
                          onChange={(e) => updateQuantity(item?.id, parseInt(e?.target?.value) || 1)}
                          className="w-20 px-3 py-2 text-center border border-border rounded-md bg-background text-foreground"
                          min="1"
                        />
                        <button
                          onClick={() => updateQuantity(item?.id, (customQuantities?.[item?.id] || item?.defaultQuantity) + 1)}
                          className="p-2 border border-border rounded-md hover:bg-muted transition-smooth"
                        >
                          <Icon name="Plus" size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Material Selection */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Material Option
                      </label>
                      <select
                        value={materialOptions?.[item?.id] || 0}
                        onChange={(e) => updateMaterial(item?.id, parseInt(e?.target?.value))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      >
                        {item?.materials?.map((material, index) => (
                          <option key={index} value={index}>
                            {material?.name} (+{Math.round((material?.multiplier - 1) * 100)}%)
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item?.materials?.[materialOptions?.[item?.id] || 0]?.description}
                      </p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Base cost per {item?.unit}:</span>
                        <span className="float-right text-foreground">
                          ${Math.round(item?.baseCost / item?.defaultQuantity)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Material multiplier:</span>
                        <span className="float-right text-foreground">
                          {item?.materials?.[materialOptions?.[item?.id] || 0]?.multiplier}x
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantity:</span>
                        <span className="float-right text-foreground">
                          {customQuantities?.[item?.id] || item?.defaultQuantity}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <span className="font-medium text-foreground">Total:</span>
                        <span className="float-right font-semibold text-primary">
                          ${calculateItemCost(item)?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="default"
          size="lg"
          onClick={() => onCalculate && onCalculate(getTotalCost())}
          iconName="Calculator"
          iconPosition="left"
          className="flex-1"
        >
          Update Estimate (${getTotalCost()?.toLocaleString()})
        </Button>
        <Button
          variant="outline"
          size="lg"
          iconName="Download"
          iconPosition="left"
        >
          Download Quote
        </Button>
        <Button
          variant="ghost"
          size="lg"
          iconName="RotateCcw"
          iconPosition="left"
          onClick={() => {
            setSelectedItems({});
            setCustomQuantities({});
            setMaterialOptions({});
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
};

export default CostCalculator;