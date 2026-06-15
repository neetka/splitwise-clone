import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService, importService } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  Plus, Users, LogOut, TrendingUp, TrendingDown, 
  Wallet, RefreshCw, UploadCloud, AlertTriangle, 
  CheckCircle2, X, AlertCircle, FileText, ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create Group Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState('');

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [importError, setImportError] = useState('');

  // Balance Aggregations
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

  // Import Approvals state
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setImportError('');
    } else {
      setSelectedFile(null);
      setImportError('Please select a valid CSV file');
    }
  };

  const handleCSVImport = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setImportError('Please select a CSV file first');
      return;
    }

    setUploading(true);
    setImportError('');
    setImportReport(null);

    try {
      const res = await importService.importCSV(selectedFile);
      if (res.success) {
        setImportReport(res.report);
        fetchDashboardData();
      } else {
        setImportError(res.message || 'Import failed');
      }
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await importService.getPendingApprovals();
      if (res.success) {
        setPendingApprovals(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch pending approvals', err);
    }
  };

  const handleApproveAction = async (id, action) => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this import?`)) return;
    try {
      const res = await importService.actionApproval(id, action);
      if (res.success) {
        fetchDashboardData();
        fetchPendingApprovals();
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      fetchPendingApprovals();

      const res = await groupService.listGroups();
      if (res.success) {
        setGroups(res.data);
        
        let owedToYouSum = 0;
        let youOweSum = 0;

        const detailPromises = res.data.map(g => groupService.getGroupDetails(g.id));
        const detailsResults = await Promise.all(detailPromises);

        detailsResults.forEach(detailRes => {
          if (detailRes.success && detailRes.data.balances) {
            const userBal = detailRes.data.balances.find(b => b.userId === user.id);
            if (userBal) {
              const net = userBal.netBalance;
              if (net > 0) {
                owedToYouSum += net;
              } else if (net < 0) {
                youOweSum += Math.abs(net);
              }
            }
          }
        });

        setTotalOwedToYou(Number(owedToYouSum.toFixed(2)));
        setTotalYouOwe(Number(youOweSum.toFixed(2)));
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Failed to load dashboard data. Please reload.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!newGroupName || newGroupName.trim() === '') {
      setModalError('Group name is required');
      return;
    }

    setCreating(true);
    try {
      const res = await groupService.createGroup(newGroupName);
      if (res.success) {
        setNewGroupName('');
        setShowGroupModal(false);
        fetchDashboardData();
      } else {
        setModalError(res.message);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!importReport) return;

    const reportData = {
      importDate: new Date(importReport.createdAt).toLocaleString(),
      failedRows: importReport.statistics.skippedRowsCount,
      anomalies: importReport.anomalies.map(a => ({
        rowNumber: a.rowNumber,
        anomalyType: a.anomalyType,
        description: a.description,
        actionTaken: a.actionTaken,
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import_report_${importReport.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const netOverall = Number((totalOwedToYou - totalYouOwe).toFixed(2));

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-textPrimary">Dashboard</h1>
            <p className="text-sm text-textSecondary mt-1">Track expenses, balances and settlements</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDashboardData}
              disabled={loading}
              className="h-10 w-10 text-textSecondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 border-border bg-surface hover:bg-muted text-textPrimary">
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle className="text-xl">Import Expenses from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a Splitwise-formatted CSV file to batch-import group expenses.
                  </DialogDescription>
                </DialogHeader>

                {importError && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {importError}
                  </div>
                )}

                {!importReport ? (
                  <form onSubmit={handleCSVImport} className="space-y-6 py-4">
                    <div className="border-2 border-dashed border-border hover:border-primary rounded-xl p-10 text-center bg-muted/50 cursor-pointer transition-colors relative group">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <UploadCloud className="mx-auto h-12 w-12 text-textSecondary group-hover:text-primary transition-colors mb-4" />
                      <p className="text-sm font-semibold text-textPrimary">
                        {selectedFile ? selectedFile.name : 'Click or drag your CSV file here'}
                      </p>
                      <p className="text-xs text-textSecondary mt-2">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports standard .csv format'}
                      </p>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setShowImportModal(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={uploading || !selectedFile} className="bg-primary hover:bg-primary-hover text-white">
                        {uploading ? (
                          <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</span>
                        ) : 'Upload and Import'}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="space-y-6 py-4">
                    {/* Import Report View */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="shadow-none border-border">
                        <CardHeader className="p-4 pb-2">
                          <CardDescription className="uppercase font-semibold text-[10px]">Status</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <Badge variant={importReport.status === 'COMPLETED' ? 'default' : 'destructive'} className={importReport.status === 'COMPLETED' ? 'bg-success hover:bg-success/90' : ''}>
                            {importReport.status}
                          </Badge>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none border-border">
                        <CardHeader className="p-4 pb-2">
                          <CardDescription className="uppercase font-semibold text-[10px]">Anomalies</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <span className="text-2xl font-bold text-textPrimary">{importReport.statistics.totalAnomalies}</span>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none border-border">
                        <CardHeader className="p-4 pb-2">
                          <CardDescription className="uppercase font-semibold text-[10px]">Skipped Rows</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <span className="text-2xl font-bold text-destructive">{importReport.statistics.skippedRowsCount}</span>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="rounded-md border border-border">
                      <ScrollArea className="h-[250px]">
                        <div className="p-4">
                          <h4 className="text-sm font-semibold mb-4 text-textPrimary">Validation Logs</h4>
                          {importReport.anomalies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <CheckCircle2 className="h-10 w-10 text-success mb-2" />
                              <p className="text-sm font-medium text-textPrimary">Zero Anomalies!</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {importReport.anomalies.map((anomaly) => (
                                <div key={anomaly.id} className="flex gap-4 items-start p-3 rounded-lg bg-muted/50 border border-border">
                                  <Badge variant="outline" className="shrink-0 font-mono text-xs">Row {anomaly.rowNumber}</Badge>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-textPrimary">{anomaly.anomalyType}</span>
                                      <Badge variant="secondary" className="text-[10px] h-5">{anomaly.actionTaken}</Badge>
                                    </div>
                                    <p className="text-xs text-textSecondary">{anomaly.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={handleDownloadReport}>Download Report</Button>
                      <Button onClick={() => { setShowImportModal(false); setImportReport(null); fetchDashboardData(); }} className="bg-primary hover:bg-primary-hover">
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
              <DialogTrigger asChild>
                <Button className="h-10 bg-primary hover:bg-primary-hover text-white shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>
                    Start a new group to split expenses with friends or roommates.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGroup} className="space-y-4 pt-4">
                  {modalError && (
                    <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium">
                      {modalError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-textPrimary">Group Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Goa Trip 2026"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full flex h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setShowGroupModal(false)}>Cancel</Button>
                    <Button type="submit" disabled={creating} className="bg-primary hover:bg-primary-hover text-white">
                      {creating ? 'Creating...' : 'Create Group'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Balance Summaries Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow duration-200 border-border/60">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider">Owed to You</p>
                  <h3 className="text-3xl font-bold text-success">₹{totalOwedToYou}</h3>
                </div>
                <div className="p-2.5 bg-success/10 rounded-xl text-success">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow duration-200 border-border/60">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider">You Owe</p>
                  <h3 className="text-3xl font-bold text-destructive">₹{totalYouOwe}</h3>
                </div>
                <div className="p-2.5 bg-destructive/10 rounded-xl text-destructive">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow duration-200 border-border/60">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider">Net Balance</p>
                  <h3 className={`text-3xl font-bold ${netOverall >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {netOverall >= 0 ? `₹${netOverall}` : `-₹${Math.abs(netOverall)}`}
                  </h3>
                </div>
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Section */}
        {pendingApprovals.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-textPrimary">Pending Approvals ({pendingApprovals.length})</h2>
            </div>
            <div className="grid gap-4">
              {pendingApprovals.map((appr) => (
                <Card key={appr.id} className="border-border">
                  <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{appr.anomalyType}</Badge>
                        <span className="text-xs text-textSecondary font-medium">Row {appr.rowNumber}</span>
                        <span className="text-xs text-textSecondary px-2 py-0.5 bg-muted rounded">Group: {appr.groupName}</span>
                      </div>
                      <p className="text-sm font-semibold text-textPrimary">{appr.description}</p>
                      <p className="text-xs text-textSecondary">
                        Payer: {appr.payerEmail} • Amount: {appr.originalCurrency === 'USD' ? `$${appr.originalAmount}` : `₹${appr.originalAmount}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={() => handleApproveAction(appr.id, 'REJECT')}>Reject</Button>
                      <Button size="sm" className="w-full md:w-auto bg-success hover:bg-success/90 text-white" onClick={() => handleApproveAction(appr.id, 'APPROVE')}>Approve</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Groups Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-textPrimary">Your Groups</h2>
              <Badge variant="secondary" className="bg-muted text-textSecondary font-semibold">
                {groups.length}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="border-border shadow-none h-[120px] animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <Card className="border-dashed border-border border-2 bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-textSecondary" />
                </div>
                <h3 className="text-lg font-bold text-textPrimary mb-1">No groups yet</h3>
                <p className="text-sm text-textSecondary mb-6 max-w-sm">
                  Create a group to start tracking expenses with your friends, roommates, or travel buddies.
                </p>
                <Button onClick={() => setShowGroupModal(true)} className="bg-primary hover:bg-primary-hover text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <Card 
                  key={group.id} 
                  className="group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 border-border/80 overflow-hidden relative"
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-300" />
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {group.name.substring(0, 2).toUpperCase()}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-textSecondary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <h3 className="font-bold text-textPrimary text-lg mb-1 truncate">{group.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-textSecondary">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {group.membersCount} members</span>
                        <span>•</span>
                        <span className="truncate">By {group.creator.id === user.id ? 'You' : group.creator.name}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
