import React from 'react';


interface NftDefectsPageProps {
  defects: {
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
  };
  onGoHome?: () => void;
}

const NftDefectsPage: React.FC<NftDefectsPageProps> = ({ defects, onGoHome }) => {
  const isNoDefect = defects?.def_ntf === true;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-4">NTF Check Results</h2>
        <div
          className={`p-6 rounded-lg ${
            isNoDefect ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'
          }`}
        >
          <p className={`text-xl font-semibold ${isNoDefect ? 'text-green-700' : 'text-red-700'}`}>
            {isNoDefect ? 'No defects found' : 'Defects found in the panel'}
          </p>
        </div>
      </div>

      {onGoHome && (
        <button
          className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 text-lg font-semibold"
          onClick={onGoHome}
        >
          Go back to NTF Checker start
        </button>
      )}
    </div>
  );
};

 export default NftDefectsPage;