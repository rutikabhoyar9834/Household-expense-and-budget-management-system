// Budget Management Module
let currentBudgets = {};
let currentExpenses = {};
let budgetChart = null;

$(document).ready(function() {
    initializeBudgetModule();
});

function initializeBudgetModule() {
    // Set current month as default
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    $('#monthYear').val(currentMonth);
    
    // Load budgets
    loadBudgets(currentMonth);
    
    // Event listeners
    $('#monthYear').on('change', function() {
        loadBudgets($(this).val());
    });
    
    $('#budgetForm').on('submit', function(e) {
        e.preventDefault();
        saveBudgets();
    });
    
    // Add budget validation
    $('input[id^="budget_"]').on('input', function() {
        validateBudgetInput(this);
    });
}

function loadBudgets(monthYear) {
    showLoading();
    const [year, month] = monthYear.split('-');
    
    $.ajax({
        url: `/api/budgets?month=${parseInt(month)}&year=${parseInt(year)}`,
        method: 'GET',
        success: function(budgets) {
            currentBudgets = {};
            
            // Reset all budget inputs
            $('input[id^="budget_"]').val('');
            $('input[id^="budget_"]').removeClass('is-valid is-invalid');
            
            // Populate existing budgets
            budgets.forEach(budget => {
                $(`#budget_${budget.category}`).val(budget.amount);
                currentBudgets[budget.category] = budget.amount;
                validateBudgetInput(document.getElementById(`budget_${budget.category}`));
            });
            
            // Load actual expenses for the month
            loadActualExpenses(month, year);
        },
        error: function() {
            showNotification('Error loading budgets', 'error');
            hideLoading();
        }
    });
}

function loadActualExpenses(month, year) {
    $.ajax({
        url: '/api/expenses',
        method: 'GET',
        success: function(expenses) {
            const filteredExpenses = expenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate.getMonth() + 1 === parseInt(month) && 
                       expenseDate.getFullYear() === parseInt(year);
            });
            
            // Calculate totals by category
            currentExpenses = {};
            filteredExpenses.forEach(expense => {
                currentExpenses[expense.category] = (currentExpenses[expense.category] || 0) + expense.amount;
            });
            
            displayBudgetUtilization();
            createBudgetChart();
            checkBudgetAlerts();
            hideLoading();
        },
        error: function() {
            hideLoading();
            showNotification('Error loading expenses', 'error');
        }
    });
}

function saveBudgets() {
    const monthYear = $('#monthYear').val();
    const [year, month] = monthYear.split('-');
    const categories = ['Food', 'Rent', 'Electricity', 'Water', 'Internet', 
                       'Travel', 'Shopping', 'Healthcare', 'Education', 'Entertainment'];
    
    let hasError = false;
    const savePromises = [];
    
    categories.forEach(category => {
        const amount = $(`#budget_${category}`).val();
        if (amount && parseFloat(amount) > 0) {
            if (parseFloat(amount) !== currentBudgets[category]) {
                savePromises.push(
                    $.ajax({
                        url: '/api/budgets',
                        method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            category: category,
                            amount: parseFloat(amount),
                            month: parseInt(month),
                            year: parseInt(year)
                        })
                    })
                );
            }
        } else if (amount && parseFloat(amount) <= 0) {
            showNotification(`${category} budget must be greater than 0`, 'error');
            hasError = true;
        }
    });
    
    if (hasError) return;
    
    if (savePromises.length === 0) {
        showNotification('No changes to save', 'info');
        return;
    }
    
    showLoading();
    Promise.all(savePromises)
        .then(() => {
            showNotification('Budgets saved successfully', 'success');
            loadBudgets(monthYear);
        })
        .catch(() => {
            hideLoading();
            showNotification('Error saving budgets', 'error');
        });
}

function displayBudgetUtilization() {
    const container = $('#budgetUtilization');
    container.empty();
    
    const categories = Object.keys(currentBudgets);
    
    if (categories.length === 0) {
        container.html(`
            <div class="text-center py-5">
                <i class="fas fa-chart-line fa-3x text-muted mb-3"></i>
                <p>No budgets set for this month</p>
                <button class="btn btn-primary btn-sm" onclick="$('#budget_Food').focus()">
                    Set Budgets
                </button>
            </div>
        `);
        return;
    }
    
    categories.forEach(category => {
        const budget = currentBudgets[category];
        const actual = currentExpenses[category] || 0;
        const percentage = (actual / budget) * 100;
        const remaining = budget - actual;
        
        let progressClass = 'bg-success';
        let statusIcon = '✅';
        let alertMessage = '';
        
        if (percentage > 100) {
            progressClass = 'bg-danger';
            statusIcon = '⚠️';
            alertMessage = `
                <div class="alert alert-danger mt-2 fade-in-up">
                    <i class="fas fa-exclamation-triangle"></i>
                    Budget exceeded by ${formatCurrency(actual - budget)}!
                    <button class="btn btn-sm btn-outline-danger float-end" onclick="analyzeCategory('${category}')">
                        Analyze
                    </button>
                </div>
            `;
        } else if (percentage > 90) {
            progressClass = 'bg-warning';
            statusIcon = '⚠️';
            alertMessage = `
                <div class="alert alert-warning mt-2 fade-in-up">
                    <i class="fas fa-hourglass-half"></i>
                    Approaching budget limit (${percentage.toFixed(1)}% used)
                </div>
            `;
        } else if (percentage > 75) {
            progressClass = 'bg-info';
            statusIcon = '📊';
        } else {
            statusIcon = '✅';
        }
        
        const budgetCard = `
            <div class="budget-item mb-4 fade-in-up">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong><i class="fas fa-tag"></i> ${category}</strong>
                        <span class="ms-2">${statusIcon}</span>
                    </div>
                    <div class="text-end">
                        <span class="text-muted">Spent:</span>
                        <strong class="${percentage > 100 ? 'text-danger' : 'text-success'}">
                            ${formatCurrency(actual)}
                        </strong>
                        <br>
                        <small class="text-muted">Budget: ${formatCurrency(budget)}</small>
                    </div>
                </div>
                
                <div class="progress mb-2" style="height: 12px;">
                    <div class="progress-bar ${progressClass} progress-bar-striped progress-bar-animated" 
                         role="progressbar" 
                         style="width: ${Math.min(percentage, 100)}%"
                         aria-valuenow="${percentage}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                        ${percentage > 15 ? percentage.toFixed(1) + '%' : ''}
                    </div>
                </div>
                
                <div class="d-flex justify-content-between small">
                    <span class="text-muted">
                        <i class="fas fa-chart-line"></i> ${percentage.toFixed(1)}% used
                    </span>
                    <span class="${remaining >= 0 ? 'text-success' : 'text-danger'}">
                        <i class="fas fa-${remaining >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                        ${remaining >= 0 ? formatCurrency(remaining) + ' remaining' : 'Overspent by ' + formatCurrency(Math.abs(remaining))}
                    </span>
                </div>
                
                ${alertMessage}
            </div>
        `;
        
        container.append(budgetCard);
    });
    
    // Add summary card
    addBudgetSummary();
}

function addBudgetSummary() {
    const container = $('#budgetUtilization');
    const totalBudget = Object.values(currentBudgets).reduce((sum, val) => sum + val, 0);
    const totalSpent = Object.values(currentExpenses).reduce((sum, val) => sum + val, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage = (totalSpent / totalBudget) * 100;
    
    let summaryClass = 'success';
    let summaryIcon = 'fa-smile-wink';
    let summaryMessage = 'You\'re on track with your budget!';
    
    if (overallPercentage > 100) {
        summaryClass = 'danger';
        summaryIcon = 'fa-frown';
        summaryMessage = 'Total budget exceeded! Review your expenses.';
    } else if (overallPercentage > 85) {
        summaryClass = 'warning';
        summaryIcon = 'fa-exclamation-triangle';
        summaryMessage = 'Approaching total budget limit.';
    }
    
    const summaryCard = `
        <div class="card mt-4 border-${summaryClass} fade-in-up">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas ${summaryIcon} fa-2x text-${summaryClass}"></i>
                    </div>
                    <div class="text-center">
                        <h6 class="mb-1">Total Budget Summary</h6>
                        <h4 class="mb-0">${formatCurrency(totalSpent)} / ${formatCurrency(totalBudget)}</h4>
                        <small class="text-muted">${summaryMessage}</small>
                    </div>
                    <div>
                        <div class="progress" style="width: 80px; height: 80px;">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${Math.min(overallPercentage, 100)}%">
                                ${Math.min(overallPercentage, 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.append(summaryCard);
}

function createBudgetChart() {
    const ctx = document.getElementById('budgetChart');
    if (!ctx) return;
    
    if (budgetChart) {
        budgetChart.destroy();
    }
    
    const categories = Object.keys(currentBudgets);
    const budgetData = categories.map(cat => currentBudgets[cat]);
    const actualData = categories.map(cat => currentExpenses[cat] || 0);
    
    budgetChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                {
                    label: 'Budget',
                    data: budgetData,
                    backgroundColor: 'rgba(76, 175, 80, 0.5)',
                    borderColor: '#4caf50',
                    borderWidth: 1
                },
                {
                    label: 'Actual',
                    data: actualData,
                    backgroundColor: 'rgba(244, 67, 54, 0.5)',
                    borderColor: '#f44336',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}

function checkBudgetAlerts() {
    const alerts = [];
    
    Object.keys(currentBudgets).forEach(category => {
        const budget = currentBudgets[category];
        const actual = currentExpenses[category] || 0;
        const percentage = (actual / budget) * 100;
        
        if (percentage > 100) {
            alerts.push({
                category: category,
                severity: 'danger',
                message: `${category} budget exceeded by ${formatCurrency(actual - budget)}`
            });
        } else if (percentage > 90) {
            alerts.push({
                category: category,
                severity: 'warning',
                message: `${category} budget is at ${percentage.toFixed(1)}%`
            });
        }
    });
    
    if (alerts.length > 0) {
        showBudgetAlerts(alerts);
    }
}

function showBudgetAlerts(alerts) {
    const alertContainer = $('#budgetAlerts');
    if (alertContainer.length) {
        alertContainer.empty();
        alerts.forEach(alert => {
            alertContainer.append(`
                <div class="alert alert-${alert.severity} alert-dismissible fade show" role="alert">
                    <i class="fas fa-bell"></i>
                    ${alert.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `);
        });
    }
}

function analyzeCategory(category) {
    // Fetch and display detailed analysis for the category
    $.ajax({
        url: '/api/expenses',
        method: 'GET',
        success: function(expenses) {
            const categoryExpenses = expenses.filter(e => e.category === category);
            const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
            
            const modal = `
                <div class="modal fade" id="categoryAnalysisModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Analysis: ${category}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>Total spent: ${formatCurrency(total)}</p>
                                <p>Budget: ${formatCurrency(currentBudgets[category])}</p>
                                <p>Remaining: ${formatCurrency(currentBudgets[category] - total)}</p>
                                <hr>
                                <h6>Recent Transactions:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Description</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${categoryExpenses.map(e => `
                                                <tr>
                                                    <td>${formatDate(e.date)}</td>
                                                    <td>${e.description || '-'}</td>
                                                    <td class="text-danger">${formatCurrency(e.amount)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('body').append(modal);
            $('#categoryAnalysisModal').modal('show');
            $('#categoryAnalysisModal').on('hidden.bs.modal', function() {
                $(this).remove();
            });
        }
    });
}

function validateBudgetInput(input) {
    const value = parseFloat($(input).val());
    if (isNaN(value) || value < 0) {
        $(input).addClass('is-invalid').removeClass('is-valid');
    } else if (value > 0) {
        $(input).addClass('is-valid').removeClass('is-invalid');
    } else {
        $(input).removeClass('is-valid is-invalid');
    }
}

// Export functions for global use
window.loadBudgets = loadBudgets;
window.saveBudgets = saveBudgets;
window.analyzeCategory = analyzeCategory;