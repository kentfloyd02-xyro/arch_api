import { Router } from 'express';
const router = Router();
// Finance General Ledger / Disbursements Mock Endpoint
router.get('/finance/accounts', (req, res) => {
    res.json({
        success: true,
        data: [
            { code: '1010', name: 'Cash on Hand', balance: 500000.00 },
            { code: '1020', name: 'BDO Operating Account', balance: 4500000.00 },
            { code: '2010', name: 'Accounts Payable', balance: 120000.00 },
            { code: '5010', name: 'Payroll Expense', balance: 1039499.50 }
        ]
    });
});
router.post('/finance/confirm-funding', (req, res) => {
    const { runId, amount, receiptNumber } = req.body;
    res.json({
        success: true,
        message: 'Payroll funding confirmed by Finance stub.',
        data: {
            runId,
            amount,
            receiptNumber: receiptNumber || 'BDO-TRX-982341',
            fundedAt: new Date().toISOString()
        }
    });
});
// Supply Chain SCM Mock Endpoint
router.get('/scm/warehouses', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'wh-1', name: 'Main Plant & Chemical Warehouse', location: 'Cavite Industrial Park', capacity_utilization: '74%' },
            { id: 'wh-2', name: 'Metro Manila Distribution Depot', location: 'Valenzuela City', capacity_utilization: '88%' }
        ]
    });
});
export default router;
