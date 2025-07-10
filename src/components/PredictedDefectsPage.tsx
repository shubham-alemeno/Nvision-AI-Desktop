import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { X, RotateCcw } from 'lucide-react';
import { submitFeedback } from '@/services/api';

function PredictedDefectsPage({
  defects,
  onGoHome,
  taskUuid,
  defectDisplayMap = [],
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

      Object.entries(defects).forEach(([defectKey]) => {
        // Default: feedback is false (no correction needed)
        // If marked as incorrect: feedback is true (correction/feedback provided)
        const isMarkedIncorrect = corrections[defectKey] === true;

        feedbackData[defectKey] = {
          feedback: isMarkedIncorrect ? true : false,
        };
      });

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
