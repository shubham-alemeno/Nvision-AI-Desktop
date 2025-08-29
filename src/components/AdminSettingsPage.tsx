import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Trash2,
  Edit,
  UserPlus,
  Key,
  Eye,
  Search,
  Users,
  UserCheck,
  Shield,
  UserX,
} from 'lucide-react';
import {
  createUser,
  deleteUser,
  getUsers,
  getUserStats,
  setUserPassword,
  toggleUserActive,
  toggleUserStaff,
  updateUser,
} from '@/services/api';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
}

interface UserStats {
  total_users: number;
  active_users: number;
  staff_users: number;
  inactive_users: number;
  superusers: number;
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(
    undefined
  );
  const [filterStaff, setFilterStaff] = useState<boolean | undefined>(
    undefined
  );

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    is_active: true,
    is_staff: false,
    groups: '',
  });

  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    is_active: true,
    is_staff: false,
    groups: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, statsData] = await Promise.all([
          getUsers(),
          getUserStats(),
        ]);
        setUsers(userData);
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // const filteredUsers = users?.filter((user) => {
  //   const matchesSearch =
  //     user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     `${user.first_name} ${user.last_name}`
  //       .toLowerCase()
  //       .includes(searchTerm.toLowerCase());

  //   const matchesActive =
  //     filterActive === undefined || user.is_active === filterActive;
  //   const matchesStaff =
  //     filterStaff === undefined || user.is_staff === filterStaff;

  //   return matchesSearch && matchesActive && matchesStaff;
  // });

  const refetchData = async () => {
    setLoading(true);
    try {
      const [userData, statsData] = await Promise.all([
        getUsers(),
        getUserStats(),
      ]);
      setUsers(userData);
      setStats(statsData);
    } catch (error) {
      console.error('Error refetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      // Validate passwords match
      if (createForm.password !== createForm.confirm_password) {
        alert('Passwords do not match');
        return;
      }

      console.log('Creating user:', createForm);

      await createUser(createForm);

      setCreateForm({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        confirm_password: '',
        is_active: true,
        is_staff: false,
        groups: '',
      });
      setCreateModalOpen(false);

      alert('User created successfully!');
      await refetchData();
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error creating user:\n\n${errorMessages.join('\n')}`;
        }
      }

      alert(errorMessage);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      console.log('Updating user:', selectedUser.id, editForm);

      await updateUser(selectedUser.id, editForm);

      setEditModalOpen(false);
      setSelectedUser(null);

      alert('User updated successfully!');
      await refetchData();
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error editing user:\n\n${errorMessages.join('\n')}`;
        }
      }

      alert(errorMessage);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      console.log('Deleting user:', userId);

      await deleteUser(userId);

      alert('User deleted successfully!');
      await refetchData();
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error deleting user:\n\n${errorMessages.join('\n')}`;
        }
      }

      alert(errorMessage);
    }
  };

  // Debounced API call function
  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm || undefined,
        is_active: filterActive,
        is_staff: filterStaff,
        // page,
        // page_size: pageSize,
      };

      const response = await getUsers(params);
      setUsers(response.results || response); // Handle both paginated and non-paginated responses
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: searchTerm || undefined,
        is_active: filterActive,
        is_staff: filterStaff,
        // page,
        // page_size: pageSize,
      };

      const response = await getUsers(params);
      setUsers(response.results || response); // Handle both paginated and non-paginated responses
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterActive, filterStaff]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // 300ms delay for search

    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // Reset to first page when filters change
  // useEffect(() => {
  //   setPage(1);
  // }, [searchTerm, filterActive, filterStaff]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      console.log('Toggling active status for user:', userId);

      await toggleUserActive(userId);

      alert('User status updated successfully!');
      await refetchData();
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error updating user status:\n\n${errorMessages.join(
            '\n'
          )}`;
        }
      }

      alert(errorMessage);
    }
  };

  const handleToggleStaff = async (userId: number) => {
    try {
      console.log('Toggling staff status for user:', userId);

      await toggleUserStaff(userId);

      alert('User staff privileges updated successfully!');
      await refetchData();
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error updating staff previleges:\n\n${errorMessages.join(
            '\n'
          )}`;
        }
      }

      alert(errorMessage);
    }
  };

  const handleSetPassword = async () => {
    if (!selectedUser) return;

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('Passwords do not match');
      return;
    }

    try {
      console.log('Setting password for user:', selectedUser.id);

      // Call real API
      await setUserPassword(selectedUser.id, {
        password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      });

      setPasswordForm({ new_password: '', confirm_password: '' });
      setPasswordModalOpen(false);
      setSelectedUser(null);

      alert('Password updated successfully!');
    } catch (error) {
      console.error('Error creating user:', error);

      // Extract detailed error messages
      let errorMessage = 'Error creating user';

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = [];

        // Handle different error formats
        Object.keys(errorData).forEach((field) => {
          const fieldErrors = errorData[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          } else if (typeof fieldErrors === 'string') {
            errorMessages.push(`${field}: ${fieldErrors}`);
          }
        });

        if (errorMessages.length > 0) {
          errorMessage = `Error updating password:\n\n${errorMessages.join(
            '\n'
          )}`;
        }
      }

      alert(errorMessage);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      is_staff: user.is_staff,
    });
    setEditModalOpen(true);
  };

  const openViewModal = (user: User) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setPasswordModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold">
                  {stats?.total_users || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm font-medium">
                  Active Users
                </CardTitle>
                <UserCheck className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold text-green-600">
                  {stats?.active_users || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm font-medium">
                  Staff Users
                </CardTitle>
                <Shield className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold text-blue-600">
                  {stats?.staff_users || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm font-medium">
                  Super Users
                </CardTitle>
                <Shield className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold text-purple-600">
                  {stats?.superusers || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm font-medium">
                  Inactive Users
                </CardTitle>
                <UserX className="h-5 w-5 text-red-600" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold text-red-600">
                  {stats?.inactive_users || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Users</CardTitle>
            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={createForm.username}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            username: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={createForm.email}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={createForm.first_name}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            first_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={createForm.last_name}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            last_name: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={createForm.password}
                      min={8}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm_password">Confirm Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={createForm.confirm_password}
                      min={8}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          confirm_password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="groups">Groups (comma-separated)</Label>
                    <Input
                      id="groups"
                      value={createForm.groups}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, groups: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={createForm.is_active}
                        onCheckedChange={(checked) =>
                          setCreateForm({ ...createForm, is_active: checked })
                        }
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_staff"
                        checked={createForm.is_staff}
                        onCheckedChange={(checked) =>
                          setCreateForm({ ...createForm, is_staff: checked })
                        }
                      />
                      <Label htmlFor="is_staff">Staff</Label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser}>Create User</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative flex">
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSearch}
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                >
                  <Search className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </div>
            </div>

            <Select
              value={
                filterActive === undefined ? 'all' : filterActive.toString()
              }
              onValueChange={(value) =>
                setFilterActive(value === 'all' ? undefined : value === 'true')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStaff === undefined ? 'all' : filterStaff.toString()}
              onValueChange={(value) =>
                setFilterStaff(value === 'all' ? undefined : value === 'true')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="true">Staff</SelectItem>
                <SelectItem value="false">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Groups</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <div>
                          <div
                            className="font-medium cursor-pointer"
                            onClick={() => openViewModal(user)}
                          >
                            {user.username}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.first_name} {user.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{user.email}</td>
                      <td className="p-3">
                        <Badge
                          variant={user.is_active ? 'default' : 'secondary'}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {user.is_superuser && (
                            <Badge variant="destructive">Super</Badge>
                          )}
                          {user.is_staff && (
                            <Badge variant="outline">Staff</Badge>
                          )}
                          {!user.is_staff && !user.is_superuser && (
                            <Badge variant="secondary">User</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {user?.groups?.length > 0
                          ? user.groups.join(', ')
                          : 'None'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          {/* <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button> */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPasswordModal(user)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {/* <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user.id)}
                          >
                            {user.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStaff(user.id)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button> */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_username">Username</Label>
                <Input
                  id="edit_username"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">First Name</Label>
                <Input
                  id="edit_first_name"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name</Label>
                <Input
                  id="edit_last_name"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_groups">Groups (comma-separated)</Label>
              <Input
                id="edit_groups"
                value={editForm.groups}
                onChange={(e) =>
                  setEditForm({ ...editForm, groups: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={editForm.is_active}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_active: checked })
                  }
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_staff"
                  checked={editForm.is_staff}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_staff: checked })
                  }
                />
                <Label htmlFor="edit_is_staff">Staff</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Update User</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Username
                  </Label>
                  <p className="text-sm">{selectedUser.username}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Email
                  </Label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    First Name
                  </Label>
                  <p className="text-sm">{selectedUser.first_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Last Name
                  </Label>
                  <p className="text-sm">{selectedUser.last_name || 'N/A'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Status
                </Label>
                <div className="flex gap-2 mt-1">
                  <Badge
                    variant={selectedUser.is_active ? 'default' : 'secondary'}
                  >
                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {selectedUser.is_superuser && (
                    <Badge variant="destructive">Superuser</Badge>
                  )}
                  {selectedUser.is_staff && (
                    <Badge variant="outline">Staff</Badge>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Groups
                </Label>
                <p className="text-sm">
                  {selectedUser?.groups?.length > 0
                    ? selectedUser?.groups.join(', ')
                    : 'None'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Date Joined
                  </Label>
                  <p className="text-sm">
                    {new Date(selectedUser.date_joined).toLocaleDateString()}
                  </p>
                </div>
                {/* <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Last Login
                  </Label>
                  <p className="text-sm">
                    {selectedUser.last_login
                      ? new Date(selectedUser.last_login).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div> */}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setViewModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  User
                </Label>
                <p className="text-sm font-medium">{selectedUser.username}</p>
              </div>
              <div>
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  min={8}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      new_password: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  min={8}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm_password: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword}>Update Password</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;
