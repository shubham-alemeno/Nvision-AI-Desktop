import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getInferenceUsage, getGroupInferenceUsage, ApiError } from '@/services/api';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface InferenceUsage {
  id: number;
  username: string;
  user_email: string;
  user_groups: string[];
  inference_count: number;
  created_at: string;
  updated_at: string;
  last_inference_at: string;
}

interface GroupUsage {
  group_name: string;
  user_count: number;
  total_inferences: number;
  average_inferences: number;
}

const UsageDataPage = () => {
  const [inferenceUsage, setInferenceUsage] = useState<InferenceUsage | null>(
    null
  );
  const [groupUsage, setGroupUsage] = useState<GroupUsage[]>([]);
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
  

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const [userUsage, groupData] = await Promise.all([
          getInferenceUsage(),
          getGroupInferenceUsage(),
        ]);
        setInferenceUsage(userUsage);
        setGroupUsage(groupData);
      } catch (error) {
        const apiError = error as ApiError;
        console.error('Error fetching usage data:', apiError);

        let errorMessage = "Failed to load usage data";
      
      if (apiError.type === 'network') {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (apiError.type === 'server') {
        errorMessage = "Server error. Please try again later.";
      } else if (apiError.type === 'authentication') {
        errorMessage = "Authentication error. Please log in again.";
      } 
      
      setError(errorMessage);
        
        // Set default values instead of showing error
        setInferenceUsage({
          id: 0,
          username: 'N/A',
          user_email: 'N/A',
          user_groups: [],
          inference_count: 0,
          created_at: '',
          updated_at: '',
          last_inference_at: ''
        });
        setGroupUsage([{
          group_name: 'N/A',
          user_count: 0,
          total_inferences: 0,
          average_inferences: 0
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, []);

      const handleRetry = () => {
    const fetchUsageData = async () => {
      setLoading(true);
      setError(null);
      try {
  const [userUsage, groupData] = await Promise.all([
          getInferenceUsage(),
          getGroupInferenceUsage(),
        ]);
        setInferenceUsage(userUsage);
        setGroupUsage(groupData);
      } catch (error) {
        const apiError = error as ApiError;
        console.error("Error fetching defects:", error);
        let errorMessage = "Failed to load usage data";
        if (apiError.type === "network") {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (apiError.type === "server") {
          errorMessage = "Server error. Please try again later.";
        } else if (apiError.type === "authentication") {
          errorMessage = "Authentication error. Please log in again.";
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchUsageData();
  };

  if (loading) {
    return (
      // <div className="flex flex-col gap-4 p-4">
      //   <Skeleton className="h-12 w-1/2" />
      //   <div className="grid grid-cols-2 gap-4">
      //     <Skeleton className="h-20 w-full" />
      //     <Skeleton className="h-20 w-full" />
      //   </div>
      // </div>
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      </div>
    );
  }

 if (error) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Defect Checker Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center py-8 space-y-4">
              <div className="text-red-500 text-center">{error}</div>
              <Button
                onClick={handleRetry}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Defect Checker Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Account usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {inferenceUsage?.inference_count || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {groupUsage[0]?.total_inferences || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Inference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{inferenceUsage?.last_inference_at ? new Date(inferenceUsage.last_inference_at).toLocaleString() : 'Never'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p>Group: {groupUsage[0]?.group_name || 'N/A'}</p>
              <p>Members: {groupUsage[0]?.user_count || 0}</p>
              <p>Avg Inferences: {groupUsage[0]?.average_inferences || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div> */}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsageDataPage;
