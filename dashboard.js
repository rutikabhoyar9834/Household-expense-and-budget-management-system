$(document).ready(function() {
    loadDashboardData();
    loadUpcomingBills();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboardData, 30000);
});

function loadDashboardData() {
    $.ajax({
        url: '/api/dashboard/stats',
        method: 'GET',
        success: function(data) {
            $('#totalIncome').text(formatCurrency(data.total_income));
            $('#totalExpenses').text(formatCurrency(data.total_expenses));
            $('#totalSavings').text(formatCurrency(data.savings));
            
            // Update recent transactions table
            updateRecentTransactions(data.recent_transactions);
            
            // Update expense pie chart
            updateExpensePieChart(data.category_expenses || []);
            
            // Load monthly data for trend chart
            loadMonthlyTrendData();
        },
        error: function(xhr, status, error) {
            console.error('Error loading dashboard data:', error);
            showNotification('Error loading dashboard data', 'error');
        }
    });
}

function updateRecentTransactions(transactions) {
    const tbody = $('#recentTransactionsBody');
    tbody.empty();
    
    if (transactions.length === 0) {
        tbody.html('<tr><td colspan="4" class="text-center">No transactions found</td></tr>');
        return;
    }
    
    transactions.forEach(transaction => {
        const row = `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>
                    <span class="badge ${transaction.type === 'Income' ? 'bg-success' : 'bg-danger'}">
                        ${transaction.type}
                    </span>
                </td>
                <td>${transaction.category}</td>
                <td class="${transaction.type === 'Income' ? 'text-success' : 'text-danger'}">
                    ${transaction.type === 'Income' ? '+' : '-'} ${formatCurrency(transaction.amount)}
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

function loadMonthlyTrendData() {
    const currentYear = $('#yearSelect').val() || new Date().getFullYear();
    
    $.ajax({
        url: `/api/reports/monthly?year=${currentYear}`,
        method: 'GET',
        success: function(data) {
            if (window.monthlyTrendChart) {
                updateMonthlyTrendChart(data);
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading monthly trend data:', error);
        }
    });
}

function loadUpcomingBills() {
    console.log("loadUpcomingBills called");
    $.ajax({
        url: '/api/bills',
        method: 'GET',
        success: function(bills) {
            console.log("BILLS RESPONSE:", bills);

            const billsContainer = $('#upcomingBills');
            billsContainer.empty();

            if (!bills || bills.length === 0) {
                billsContainer.html('<div class="text-center">No upcoming bills</div>');
                return;
            }

            bills.forEach(bill => {
                const dueDate = new Date(bill.due_date || new Date());
                const today = new Date();
                const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                const isUrgent = daysUntilDue <= 3;

                const billCard = `
                    <div class="bill-card ${isUrgent ? 'urgent' : ''}" style="padding:10px; border-bottom:1px solid #ddd;">
                        <div class="d-flex justify-content-between">
                            <div>
                                <strong>${bill.bill_name}</strong><br>
                                <small>Due: ${bill.due_date || 'N/A'}</small>
                            </div>
                            <div class="text-end">
                                ₹${bill.amount || 0}
                                <br>
                                ${isUrgent ? '<span class="badge bg-danger">Urgent</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;

                billsContainer.append(billCard);
            });
        },
        error: function(xhr, status, error) {
            console.error('Error loading bills:', error);
            $('#upcomingBills').html('<div class="text-center">Error loading bills</div>');
        }
    });
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotification(message, type) {
    // Simple notification using bootstrap alert
    const alertDiv = $(`
        <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999;" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    $('body').append(alertDiv);
    setTimeout(() => alertDiv.alert('close'), 5000);
}