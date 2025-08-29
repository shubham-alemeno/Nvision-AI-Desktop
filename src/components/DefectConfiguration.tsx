import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Check, Save } from 'lucide-react';

const DefectConfiguration = ({ onDefectsSelected, selectedDefects = [] }) => {
  const [checkedDefects, setCheckedDefects] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Complete defect list with mapping to keys
  const defectsList = [
    {
      id: 1,
      name: 'Abnormal Display',
      faultCode: 'VID - Abnormal Display',
      key: 'def_abnormal_display',
    },
    {
      id: 2,
      name: 'Horizontal Line',
      faultCode: 'VID - Horizontal Line',
      key: 'def_horizontal_line',
    },
    {
      id: 3,
      name: 'Horizontal Band',
      faultCode: 'VID - Horizontal Band',
      key: 'def_horizontal_band',
    },
    {
      id: 4,
      name: 'Vertical Line',
      faultCode: 'VID - Vertical Line',
      key: 'def_vertical_line',
    },
    {
      id: 5,
      name: 'Vertical Band',
      faultCode: 'VID - Vertical Band',
      key: 'def_vertical_band',
    },
    {
      id: 6,
      name: 'Particles',
      faultCode: 'VID - Particles',
      key: 'def_particles',
    },
    {
      id: 7,
      name: 'White Patch',
      faultCode: 'CID - White Patch',
      key: 'def_white_patches',
    },
    {
      id: 8,
      name: 'Polariser Scratches / Dent',
      faultCode: 'CID - Polariser Scratches / Dent',
      key: 'def_polariser_scratches',
    },
    {
      id: 9,
      name: 'Light Leakage',
      faultCode: 'VID - Light Leakage',
      key: 'def_light_leakage',
    },
    { id: 10, name: 'Mura', faultCode: 'VID - Mura', key: 'def_mura' },
    {
      id: 11,
      name: 'Incoming Border Patch',
      faultCode: 'VID - Incoming Border Patch',
      key: 'def_incoming_border_patch',
    },
    {
      id: 12,
      name: 'Pixel Bright Dot',
      faultCode: 'VID - Pixel Bright Dot',
      key: 'def_pixel_bright_dot',
    },
    {
      id: 13,
      name: 'Incoming Galaxy',
      faultCode: 'BER - Incoming Galaxy',
      key: 'def_incoming_galaxy',
    },
    { id: 14, name: 'Led Off', faultCode: 'VID - Led Off', key: 'def_led_off' },
    {
      id: 15,
      name: 'Bleeding',
      faultCode: 'VID - Bleeding',
      key: 'def_bleeding',
    },
    {
      id: 16,
      name: 'No Trouble Found',
      faultCode: 'NTF - No Trouble Found',
      key: 'def_no_trouble_found',
    },
    {
      id: 17,
      name: 'Other Defects',
      faultCode: 'Other Defects',
      key: 'def_other_defects',
    },
  ];

  // Get all defect keys for default selection
  const getAllDefectKeys = () => defectsList.map((defect) => defect.key);

  // Load saved defects from localStorage on component mount
  useEffect(() => {
    const allDefects = getAllDefectKeys();

    try {
      const savedDefects = localStorage.getItem('selectedDefects');
      if (savedDefects) {
        const parsedDefects = JSON.parse(savedDefects);
        // If saved defects exist and are not empty, use them
        if (parsedDefects.length > 0) {
          setCheckedDefects(new Set(parsedDefects));
        } else {
          // If saved defects exist but are empty, use all defects and save them
          setCheckedDefects(new Set(allDefects));
          localStorage.setItem('selectedDefects', JSON.stringify(allDefects));
        }
        // Override with props if provided and not empty
        if (selectedDefects.length > 0) {
          setCheckedDefects(new Set(selectedDefects));
        }
      } else if (selectedDefects.length > 0) {
        // Use props if no saved data but props provided
        setCheckedDefects(new Set(selectedDefects));
      } else {
        // No saved data and no props - use all defects and save them
        setCheckedDefects(new Set(allDefects));
        localStorage.setItem('selectedDefects', JSON.stringify(allDefects));
      }
    } catch (error) {
      console.error('Error loading saved defects:', error);
      // Fallback to all defects selection and save them
      setCheckedDefects(new Set(allDefects));
      localStorage.setItem('selectedDefects', JSON.stringify(allDefects));
    }
    setIsLoading(false);
  }, [selectedDefects]);

  const handleDefectToggle = (defectKey) => {
    setCheckedDefects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(defectKey)) {
        newSet.delete(defectKey);
      } else {
        newSet.add(defectKey);
      }

      // If the set becomes empty, apply all defects as defaults
      let finalSet = newSet;
      if (newSet.size === 0) {
        const allDefects = getAllDefectKeys();
        finalSet = new Set(allDefects);
        console.log(
          'Applied all defects due to empty selection:',
          Array.from(finalSet)
        );
      }

      // Automatically save configuration after state update
      setTimeout(() => {
        handleSaveConfiguration(finalSet);
      }, 0);

      return finalSet;
    });
  };

  const handleSelectAll = () => {
    let newSet;
    if (checkedDefects.size === defectsList.length) {
      // Deselecting all - apply all defects instead of empty (since we want all by default)
      const allDefects = getAllDefectKeys();
      newSet = new Set(allDefects);
    } else {
      newSet = new Set(defectsList.map((defect) => defect.key));
    }

    setCheckedDefects(newSet);

    // Automatically save configuration after state update
    setTimeout(() => {
      handleSaveConfiguration(newSet);
    }, 0);
  };

  const handleSaveConfiguration = (customCheckedDefects = null) => {
    setIsSaving(true);
    try {
      const defectsToSave = customCheckedDefects || checkedDefects;
      // Save to localStorage
      localStorage.setItem(
        'selectedDefects',
        JSON.stringify(Array.from(defectsToSave))
      );

      // Create the defect display map for the PredictedDefectsPage
      const selectedDefectsList = defectsList.filter((defect) =>
        defectsToSave.has(defect.key)
      );
      const defectDisplayMap = selectedDefectsList.map((defect) => ({
        key: defect.key,
        label: defect.name,
      }));

      // Pass the selected defects back to parent component
      if (onDefectsSelected) {
        const defectsArray = Array.from(defectsToSave);
        console.log('Notifying parent with defects:', defectsArray);
        onDefectsSelected(defectsArray, defectDisplayMap);
      }

      setTimeout(() => {
        setIsSaving(false);
      }, 300);
    } catch (error) {
      console.error('Error saving defects configuration:', error);
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-center p-8">
          <div className="text-lg">Loading defect configuration...</div>
        </div>
      </div>
    );
  }

  const allSelected = checkedDefects.size === defectsList.length;
  const someSelected = checkedDefects.size > 0;

  // Check if current selection matches all defects (new default)
  const allDefects = getAllDefectKeys();
  const isDefaultSelection =
    allDefects.length === checkedDefects.size &&
    allDefects.every((defect) => checkedDefects.has(defect));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Defect Configuration
          </h2>
          <p className="text-gray-600 mt-1">
            Select which defects you want to monitor and check during inspection
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Available Defects ({checkedDefects.size} selected)
            </CardTitle>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {defectsList.map((defect) => {
              const isChecked = checkedDefects.has(defect.key);
              return (
                <label
                  key={defect.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleDefectToggle(defect.key)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-sm">{defect.name}</div>
                    <div className="text-xs text-gray-500">
                      {defect.faultCode}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {checkedDefects.size} defect(s) selected for monitoring
                {isSaving && (
                  <span className="ml-2 text-blue-600 flex items-center gap-1">
                    <Save className="w-3 h-3 animate-pulse" />
                    Auto-saving...
                  </span>
                )}
              </div>
              {!someSelected && (
                <div className="text-sm text-red-500">
                  Please select at least one defect to monitor
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DefectConfiguration;
