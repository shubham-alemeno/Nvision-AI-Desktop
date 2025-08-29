import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { X, RotateCcw } from 'lucide-react';
import { submitFeedback } from '@/services/api';

function PredictedDefectsPage({
  defects,
  onGoHome,
  taskUuid,
  defectDisplayMap = [
    { key: 'def_abnormal_display', label: 'Abnormal Display' },
    { key: 'def_horizontal_line', label: 'Horizontal Line' },
    { key: 'def_horizontal_band', label: 'Horizontal Band' },
    { key: 'def_vertical_line', label: 'Vertical Line' },
    { key: 'def_vertical_band', label: 'Vertical Band' },
    { key: 'def_particles', label: 'Particles' },
    { key: 'def_white_patches', label: 'White Patches' },
    { key: 'def_polariser_scratches', label: 'Polariser Scratches' },
    { key: 'def_light_leakage', label: 'Light Leakage' },
    { key: 'def_mura', label: 'Mura' },
    { key: 'def_incoming_border_patch', label: 'Incoming Border Patch' },
    { key: 'def_pixel_bright_dot', label: 'Pixel Bright Dot' },
    { key: 'def_incoming_galaxy', label: 'Incoming Galaxy' },
    { key: 'def_led_off', label: 'LED Off' },
    { key: 'def_bleeding', label: 'Bleeding' },
    // { key: 'def_no_trouble_found', label: 'No Trouble Found' },
    // { key: 'def_other_defects', label: 'Other Defects' },
  ],
}) {
  const [corrections, setCorrections] = useState({});
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  console.log(defects);
  const handleMarkIncorrect = (defectKey) => {
    setCorrections((prev) => ({
      ...prev,
      [defectKey]: true,
    }));
  };

  const handleUndoCorrection = (defectKey) => {
    setCorrections((prev) => {
      const newCorrections = { ...prev };
      delete newCorrections[defectKey];
      return newCorrections;
    });
  };

  const handleSubmitCorrections = async () => {
    if (!taskUuid) {
      console.error('No task UUID available for feedback submission');
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      const feedbackData = {};

      Object.entries(defects).forEach(([defectKey, predictedValue]) => {
        // Logic: Send classification strings based on prediction vs user feedback
        // False (not found) + selected for feedback = False Negative
        // False (not found) + not selected = True Negative
        // True (found) + selected for feedback = False Positive
        // True (found) + not selected = True Positive
        const isMarkedIncorrect = corrections[defectKey] === true;

        let feedbackValue: string;
        if (predictedValue === false && isMarkedIncorrect) {
          feedbackValue = 'False Negative'; // Model said not found, but user says it should be found
        } else if (predictedValue === false && !isMarkedIncorrect) {
          feedbackValue = 'True Negative'; // Model said not found, user agrees
        } else if (predictedValue === true && isMarkedIncorrect) {
          feedbackValue = 'False Positive'; // Model said found, but user says it shouldn't be found
        } else if (predictedValue === true && !isMarkedIncorrect) {
          feedbackValue = 'True Positive'; // Model said found, user agrees
        }

        feedbackData[defectKey] = {
          feedback: feedbackValue,
        };

        console.log(
          `${defectKey}: predicted=${predictedValue}, marked=${isMarkedIncorrect}, feedback=${feedbackValue}`
        );
      });

      console.log('Final feedback payload:', feedbackData);
      const response = await submitFeedback(taskUuid, feedbackData);
      console.log('Feedback submitted successfully:', response);

      setFeedbackSubmitted(true);
      setCorrections({}); // Clear corrections after successful submission
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const hasCorrections = Object.keys(corrections).length > 0;

  return (
    <div>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Defect Checker</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Defect report</CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackSubmitted && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
                <p className="text-green-800 font-medium">
                  Thank you! Your feedback has been submitted successfully.
                </p>
              </div>
            )}

            <ul className="space-y-3">
              {defectDisplayMap.map(({ key, label }) => {
                const found = defects[key];
                const isMarkedIncorrect = corrections[key];
                return (
                  <li key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          found ? 'bg-red-500' : 'bg-green-500'
                        }`}
                      ></span>
                      <span
                        className={isMarkedIncorrect ? 'text-orange-500' : ''}
                      >
                        {`${label} ${found ? 'Found' : 'Not Found'}`}
                        {isMarkedIncorrect && ' (Marked Incorrect)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMarkedIncorrect ? (
                        <button
                          onClick={() => handleUndoCorrection(key)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Undo correction"
                          disabled={feedbackSubmitted}
                        >
                          <RotateCcw className="w-4 h-4 text-orange-500" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkIncorrect(key)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Mark as incorrect"
                          disabled={feedbackSubmitted}
                        >
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasCorrections && !feedbackSubmitted && (
              <button
                className="mt-6 w-full px-6 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmitCorrections}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Submitting...' : 'Submit Corrections'}
              </button>
            )}

            {onGoHome && (
              <button
                className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 text-lg font-semibold"
                onClick={onGoHome}
              >
                Go back to Defect Checker start
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PredictedDefectsPage;
