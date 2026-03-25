import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { ArrowLeft, Landmark, CreditCard, AlertTriangle } from 'lucide-react';
import './Banking.css';

interface Loan {
  id: string;
  lenderId: string | null;
  borrowerId: string;
  amount: number;
  interestRate: number;
  amountOwed: number;
  amountPaid: number;
  dueDate: string;
  status: string;
  isWorldBank: boolean;
  lender: { username: string } | null;
  borrower: { username: string };
}

const Banking: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loanAmount, setLoanAmount] = useState(1000);
  const [repayAmount, setRepayAmount] = useState(0);
  const [repayingId, setRepayingId] = useState<string | null>(null);

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await api.get('/banking/my');
      setLoans(res.data);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestWorldBankLoan = async () => {
    try {
      await api.post('/banking/world-bank', { amount: loanAmount });
      await fetchLoans();
      alert(`Loan of ${loanAmount} credits approved!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to request loan');
    }
  };

  const repayLoan = async (loanId: string) => {
    if (repayAmount <= 0) return;
    try {
      await api.post(`/banking/${loanId}/repay`, { amount: repayAmount });
      setRepayingId(null);
      setRepayAmount(0);
      await fetchLoans();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to repay');
    }
  };

  const getDaysLeft = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days` : 'OVERDUE';
  };

  const activeLoans = loans.filter(l => l.status === 'active' && l.borrowerId === user?.id);
  const pastLoans = loans.filter(l => l.status !== 'active' || l.borrowerId !== user?.id);

  return (
    <div className="banking-page">
      <header className="banking-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1><Landmark size={28} /> Banking</h1>
      </header>

      {/* World Bank Section */}
      <section className="bank-section">
        <h2><Landmark size={18} /> World Bank</h2>
        <p className="bank-desc">Borrow credits from the World Bank. 10% interest rate, 7 days to repay. Max 3 active loans.</p>
        <div className="loan-form">
          <div className="form-row">
            <label>Amount (100 - 50,000)</label>
            <input
              type="number"
              min={100}
              max={50000}
              value={loanAmount}
              onChange={e => setLoanAmount(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="loan-preview">
            <span>You receive: <strong>{loanAmount.toLocaleString()}</strong> credits</span>
            <span>You repay: <strong>{Math.ceil(loanAmount * 1.1).toLocaleString()}</strong> credits</span>
            <span>Due in: <strong>7 days</strong></span>
          </div>
          <button className="btn-primary" onClick={requestWorldBankLoan} disabled={loanAmount < 100}>
            Request Loan
          </button>
        </div>
      </section>

      {/* Active Loans */}
      <section className="bank-section">
        <h2><CreditCard size={18} /> Active Loans</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeLoans.length === 0 ? (
          <p className="empty-text">No active loans</p>
        ) : (
          <div className="loans-list">
            {activeLoans.map(loan => (
              <div key={loan.id} className={`loan-card ${getDaysLeft(loan.dueDate) === 'OVERDUE' ? 'overdue' : ''}`}>
                <div className="loan-info">
                  <div className="loan-source">
                    {loan.isWorldBank ? 'World Bank' : `From: ${loan.lender?.username}`}
                  </div>
                  <div className="loan-amounts">
                    <span>Borrowed: {loan.amount.toLocaleString()}</span>
                    <span>Owed: {(loan.amountOwed - loan.amountPaid).toLocaleString()}</span>
                    <span>Paid: {loan.amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="loan-due">
                    {getDaysLeft(loan.dueDate) === 'OVERDUE' ? (
                      <span className="overdue-badge"><AlertTriangle size={12} /> OVERDUE</span>
                    ) : (
                      <span>Due in: {getDaysLeft(loan.dueDate)}</span>
                    )}
                  </div>
                  <div className="loan-progress">
                    <div className="loan-progress-bar" style={{ width: `${(loan.amountPaid / loan.amountOwed) * 100}%` }} />
                  </div>
                </div>
                {repayingId === loan.id ? (
                  <div className="repay-form">
                    <input
                      type="number"
                      min={1}
                      max={loan.amountOwed - loan.amountPaid}
                      value={repayAmount}
                      onChange={e => setRepayAmount(parseInt(e.target.value) || 0)}
                      placeholder="Amount"
                    />
                    <button onClick={() => repayLoan(loan.id)}>Pay</button>
                    <button className="btn-cancel" onClick={() => setRepayingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-repay" onClick={() => { setRepayingId(loan.id); setRepayAmount(loan.amountOwed - loan.amountPaid); }}>
                    Repay
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loan History */}
      {pastLoans.length > 0 && (
        <section className="bank-section">
          <h2>History</h2>
          <div className="loans-list">
            {pastLoans.map(loan => (
              <div key={loan.id} className={`loan-card history status-${loan.status}`}>
                <div className="loan-info">
                  <div className="loan-source">
                    {loan.isWorldBank ? 'World Bank' : loan.lender?.username || loan.borrower?.username}
                    <span className={`status-badge status-${loan.status}`}>{loan.status}</span>
                  </div>
                  <span>{loan.amount.toLocaleString()} credits at {(loan.interestRate * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Banking;
