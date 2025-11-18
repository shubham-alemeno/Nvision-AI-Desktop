import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { X, RotateCcw } from 'lucide-react';
import { submitFeedback, ApiError } from '@/services/api';


interface NftDefectsPageProps {
  defects: {
    def_ntf: boolean;
    def_mura: boolean;
    def_led_off: boolean;
    def_bleeding: boolean;
    def_particles: boolean;
    def_light_leakage: boolean;
    def_vertical_band: boolean;
    def_vertical_line: boolean;
    def_white_patches: boolean;
    def_horizontal_band: boolean;
    def_horizontal_line: boolean;
    def_incoming_galaxy: boolean;
    def_abnormal_display: boolean;
    def_pixel_bright_dot: boolean;
    def_polariser_scratches: boolean;
    def_incoming_border_patch: boolean;
  };
  onGoHome?: () => void;
  taskUuid?: string;
  defectDisplayMap?: Array<{ key: string; label: string }>;
}

const NftDefectsPage: React.FC<NftDefectsPageProps> = ({
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
  ],
}) => {
  const [corrections, setCorrections] = useState({});
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const isNoDefect = defects?.def_ntf === true;
  const isNtfIncorrect = corrections['def_ntf'] === true;

  const handleMarkIncorrect = () => {
    setCorrections((prev) => ({
      ...prev,
      def_ntf: true,
    }));
  };

  const handleUndoCorrection = () => {
    setCorrections((prev) => {
      const newCorrections = { ...prev };
      delete newCorrections['def_ntf'];
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

      // Only send feedback for def_ntf
      const defectKey = 'def_ntf';
      const predictedValue = defects[defectKey];

      // Determine feedback value based on prediction and user correction
      let feedbackValue: string;
      if (predictedValue === false && !isNtfIncorrect) {
        feedbackValue = 'True Negative';
      } else if (predictedValue === false && isNtfIncorrect) {
        feedbackValue = 'False Negative';
      } else if (predictedValue === true && !isNtfIncorrect) {
        feedbackValue = 'True Positive';
      } else if (predictedValue === true && isNtfIncorrect) {
        feedbackValue = 'False Positive';
      }

      feedbackData[defectKey] = {
        feedback: feedbackValue,
      };

      console.log(
        `${defectKey}: predicted=${predictedValue}, ntfIncorrect=${isNtfIncorrect}, feedback=${feedbackValue}`
      );

      console.log('Final feedback payload:', feedbackData);
      const response = await submitFeedback(taskUuid, feedbackData, true);
      console.log('Feedback submitted successfully:', response);

      setFeedbackSubmitted(true);
      setCorrections({});
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Failed to submit feedback:', apiError);

      let errorMessage = 'Failed to submit feedback. Please try again.';

      if (apiError.type === 'network') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (apiError.type === 'server') {
        errorMessage = 'Server error. Please try again later.';
      } else if (apiError.type === 'validation') {
        errorMessage = 'Invalid feedback data. Please check your corrections.';
      }

      alert(errorMessage);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const hasCorrections = Object.keys(corrections).length > 0;

  return (
    <div>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">NTF Checker</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>NTF Check Results</CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackSubmitted && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
                <p className="text-green-800 font-medium">
                  Thank you! Your feedback has been submitted successfully.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    isNoDefect ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></span>
                <span className={isNtfIncorrect ? 'text-orange-500' : ''}>
                  {isNoDefect ? 'No defects found in the panel' : 'Defects found in the panel'}
                  {isNtfIncorrect && ' (Marked Incorrect)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isNtfIncorrect ? (
                  <button
                    onClick={handleUndoCorrection}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Undo correction"
                    disabled={feedbackSubmitted}
                  >
                    <RotateCcw className="w-4 h-4 text-orange-500" />
                  </button>
                ) : (
                  <button
                    onClick={handleMarkIncorrect}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Mark as incorrect"
                    disabled={feedbackSubmitted}
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {!feedbackSubmitted && (
              <button
                className="mt-6 w-full px-6 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmitCorrections}
                disabled={isSubmittingFeedback}
              >
                {isSubmittingFeedback
                  ? 'Submitting...'
                  : hasCorrections
                    ? `Submit ${Object.keys(corrections).length} correction${Object.keys(corrections).length > 1 ? 's' : ''}`
                    : 'Submit with no corrections'}
              </button>
            )}

            {onGoHome && feedbackSubmitted && (
              <button
                className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 text-lg font-semibold"
                onClick={onGoHome}
              >
                Go back to NTF Checker start
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

 export default NftDefectsPage;