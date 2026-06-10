// Savings Goals Management Module
let goals = [];
let goalsChart = null;

$(document).ready(function() {
    initializeGoalsModule();
});

function initializeGoalsModule() {
    loadGoals();
    
    $('#goalForm').on('submit', function(e) {
        e.preventDefault();
        createGoal();
    });
    
    // Add validation for goal amounts
    $('#targetAmount, #currentAmount').on('input', function() {
        validateGoalInputs();
    });
}

function loadGoals() {
    showLoading();
    $.ajax({
        url: '/api/goals',
        method: 'GET',
        success: function(data) {
            goals = data;
            displayGoals();
            createGoalsChart();
            updateGoalsSummary();
            hideLoading();
        },
        error: function() {
            hideLoading();
            $('#goalsList').html(`
                <div class="text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <p>Error loading goals</p>
                    <button class="btn btn-primary" onclick="loadGoals()">Retry</button>
                </div>
            `);
        }
    });
}

function displayGoals() {
    const container = $('#goalsList');
    container.empty();
    
    if (goals.length === 0) {
        container.html(`
            <div class="text-center py-5">
                <i class="fas fa-bullseye fa-4x text-muted mb-3"></i>
                <h5>No Goals Yet</h5>
                <p>Create your first financial goal to start saving!</p>
                <button class="btn btn-primary" onclick="$('#goalName').focus()">
                    <i class="fas fa-plus"></i> Create Goal
                </button>
            </div>
        `);
        return;
    }
    
    // Sort goals: Active first, then by deadline
    const sortedGoals = [...goals].sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === 'Active' ? -1 : 1;
        }
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    sortedGoals.forEach(goal => {
        const percentage = goal.percentage;
        const deadline = new Date(goal.deadline);
        const today = new Date();
        const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        const isCompleted = percentage >= 100;
        
        let statusClass = 'bg-primary';
        let statusText = 'Active';
        let progressClass = 'bg-success';
        let urgencyIcon = '';
        
        if (isCompleted) {
            statusClass = 'bg-success';
            statusText = 'Completed 🎉';
            progressClass = 'bg-success';
        } else if (isOverdue) {
            statusClass = 'bg-danger';
            statusText = 'Overdue ⚠️';
            progressClass = 'bg-danger';
            urgencyIcon = '<i class="fas fa-exclamation-triangle text-danger"></i>';
        } else if (daysLeft <= 30) {
            statusClass = 'bg-warning';
            statusText = `Urgent - ${daysLeft} days left`;
            progressClass = 'bg-warning';
            urgencyIcon = '<i class="fas fa-hourglass-half text-warning"></i>';
        } else if (percentage >= 75) {
            statusClass = 'bg-info';
            statusText = 'Almost there!';
        }
        
        // Calculate monthly savings needed
        const remainingAmount = goal.target_amount - goal.current_amount;
        const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
        const monthlyNeeded = remainingAmount / monthsLeft;
        
        const goalCard = `
            <div class="goal-card fade-in-up">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h5 class="goal-title">
                            ${urgencyIcon} ${escapeHtml(goal.goal_name)}
                        </h5>
                        <div class="goal-date">
                            <i class="fas fa-calendar"></i> Deadline: ${formatDate(goal.deadline, 'long')}
                            ${!isCompleted && !isOverdue && daysLeft > 0 ? 
                                `<span class="badge ${statusClass} ms-2">${daysLeft} days left</span>` : ''}
                        </div>
                    </div>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                
                <div class="goal-amount mb-2">
                    <span class="h2">${formatCurrency(goal.current_amount)}</span>
                    <small class="text-muted">/ ${formatCurrency(goal.target_amount)}</small>
                </div>
                
                <div class="progress mb-3" style="height: 25px;">
                    <div class="progress-bar ${progressClass} progress-bar-striped ${!isCompleted ? 'progress-bar-animated' : ''}" 
                         role="progressbar" 
                         style="width: ${Math.min(percentage, 100)}%"
                         aria-valuenow="${percentage}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                        ${percentage.toFixed(1)}%
                    </div>
                </div>
                
                ${!isCompleted && !isOverdue ? `
                    <div class="alert alert-info mb-3">
                        <i class="fas fa-chart-line"></i>
                        <strong>Recommendation:</strong> Save ${formatCurrency(monthlyNeeded)} per month to reach your goal on time
                    </div>
                ` : ''}
                
                <div class="d-flex justify-content-between">
                    ${!isCompleted ? `
                        <button class="btn btn-sm btn-primary" onclick="showUpdateModal(${goal.id})">
                            <i class="fas fa-plus"></i> Add Progress
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="showGoalInsights(${goal.id})">
                            <i class="fas fa-chart-line"></i> Insights
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteGoal(${goal.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        container.append(goalCard);
    });
}

function createGoalsChart() {
    const ctx = document.getElementById('goalsProgressChart');
    if (!ctx) return;
    
    if (goalsChart) {
        goalsChart.destroy();
    }
    
    const activeGoals = goals.filter(g => g.status === 'Active' && g.percentage < 100);
    const labels = activeGoals.map(g => g.goal_name);
    const progress = activeGoals.map(g => g.percentage);
    const remaining = activeGoals.map(g => 100 - g.percentage);
    
    goalsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: progress,
                backgroundColor: [
                    '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336',
                    '#00bcd4', '#e91e63', '#8bc34a', '#ffc107', '#795548'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${value.toFixed(1)}% completed`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function updateGoalsSummary() {
    const summaryContainer = $('#goalsSummary');
    if (!summaryContainer.length) return;
    
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.percentage >= 100).length;
    const activeGoals = goals.filter(g => g.status === 'Active' && g.percentage < 100).length;
    const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
    const overallProgress = (totalSaved / totalTarget) * 100;
    
    const summaryHtml = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h3>${totalGoals}</h3>
                        <small>Total Goals</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${completedGoals}</h3>
                        <small>Completed</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${activeGoals}</h3>
                        <small>Active</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h3>${overallProgress.toFixed(1)}%</h3>
                        <small>Overall Progress</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    summaryContainer.html(summaryHtml);
}

function createGoal() {
    const goalData = {
        goal_name: $('#goalName').val(),
        target_amount: parseFloat($('#targetAmount').val()),
        current_amount: parseFloat($('#currentAmount').val()) || 0,
        deadline: $('#deadline').val()
    };
    
    // Validation
    if (!goalData.goal_name) {
        showNotification('Please enter a goal name', 'error');
        return;
    }
    
    if (!goalData.target_amount || goalData.target_amount <= 0) {
        showNotification('Please enter a valid target amount', 'error');
        return;
    }
    
    if (!goalData.deadline) {
        showNotification('Please select a deadline', 'error');
        return;
    }
    
    const deadlineDate = new Date(goalData.deadline);
    const today = new Date();
    if (deadlineDate <= today) {
        showNotification('Deadline must be in the future', 'error');
        return;
    }
    
    if (goalData.current_amount > goalData.target_amount) {
        showNotification('Current amount cannot exceed target amount', 'error');
        return;
    }
    
    showLoading();
    $.ajax({
        url: '/api/goals',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(goalData),
        success: function() {
            $('#goalForm')[0].reset();
            loadGoals();
            showNotification('Goal created successfully! 🎯', 'success');
            hideLoading();
            
            // Scroll to goals list
            $('html, body').animate({
                scrollTop: $('#goalsList').offset().top
            }, 500);
        },
        error: function() {
            hideLoading();
            showNotification('Error creating goal', 'error');
        }
    });
}

function showUpdateModal(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const remaining = goal.target_amount - goal.current_amount;
    
    const modalHtml = `
        <div class="modal fade" id="updateGoalModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus-circle"></i> Add Progress to "${escapeHtml(goal.goal_name)}"
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <strong>Remaining:</strong> ${formatCurrency(remaining)}<br>
                            <strong>Current:</strong> ${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)}
                        </div>
                        <form id="updateGoalForm">
                            <input type="hidden" id="updateGoalId" value="${goal.id}">
                            <div class="mb-3">
                                <label class="form-label">Add Amount *</label>
                                <input type="number" class="form-control" id="addAmount" 
                                       step="0.01" max="${remaining}" required>
                                <small class="text-muted">Maximum: ${formatCurrency(remaining)}</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Notes (Optional)</label>
                                <textarea class="form-control" id="progressNotes" rows="2"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="updateGoalProgress()">
                            <i class="fas fa-save"></i> Add Progress
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('body').append(modalHtml);
    $('#updateGoalModal').modal('show');
    
    $('#updateGoalModal').on('hidden.bs.modal', function() {
        $(this).remove();
    });
    
    // Validate amount input
    $('#addAmount').on('input', function() {
        const value = parseFloat($(this).val());
        if (value > remaining) {
            $(this).addClass('is-invalid');
            showNotification(`Amount cannot exceed ${formatCurrency(remaining)}`, 'error');
        } else {
            $(this).removeClass('is-invalid');
        }
    });
}

function updateGoalProgress() {
    const goalId = $('#updateGoalId').val();
    const addAmount = parseFloat($('#addAmount').val());
    const goal = goals.find(g => g.id == goalId);
    
    if (!goal) return;
    
    if (isNaN(addAmount) || addAmount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    const newAmount = goal.current_amount + addAmount;
    
    if (newAmount > goal.target_amount) {
        showNotification('Amount exceeds target! Please enter a smaller amount.', 'error');
        return;
    }
    
    showLoading();
    $.ajax({
        url: `/api/goals/${goalId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ current_amount: newAmount }),
        success: function() {
            $('#updateGoalModal').modal('hide');
            loadGoals();
            showNotification(`Added ${formatCurrency(addAmount)} to your goal! 🎉`, 'success');
            hideLoading();
            
            // Check if goal is completed
            if (newAmount >= goal.target_amount) {
                setTimeout(() => {
                    showNotification(`Congratulations! You've achieved your goal "${goal.goal_name}"! 🏆`, 'success');
                }, 1000);
            }
        },
        error: function() {
            hideLoading();
            showNotification('Error updating goal progress', 'error');
        }
    });
}

function showGoalInsights(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    const remaining = goal.target_amount - goal.current_amount;
    const dailyNeeded = remaining / daysLeft;
    const weeklyNeeded = dailyNeeded * 7;
    const monthlyNeeded = dailyNeeded * 30;
    
    const insightsHtml = `
        <div class="modal fade" id="goalInsightsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-chart-line"></i> Insights: ${escapeHtml(goal.goal_name)}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card mb-3">
                                    <div class="card-body">
                                        <h6>Progress Summary</h6>
                                        <canvas id="insightsProgressChart" width="200" height="200"></canvas>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="alert alert-info">
                                    <strong>Remaining:</strong> ${formatCurrency(remaining)}<br>
                                    <strong>Days Left:</strong> ${daysLeft}<br>
                                    <strong>Progress:</strong> ${goal.percentage.toFixed(1)}%
                                </div>
                                <div class="alert alert-success">
                                    <strong>Recommended Savings:</strong><br>
                                    Daily: ${formatCurrency(dailyNeeded)}<br>
                                    Weekly: ${formatCurrency(weeklyNeeded)}<br>
                                    Monthly: ${formatCurrency(monthlyNeeded)}
                                </div>
                            </div>
                        </div>
                        <div class="alert alert-warning">
                            <i class="fas fa-lightbulb"></i>
                            <strong>Tip:</strong> Set up automatic transfers to reach your goal faster!
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('body').append(insightsHtml);
    $('#goalInsightsModal').modal('show');
    
    // Create insights chart
    const ctx = document.getElementById('insightsProgressChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{
                data: [goal.current_amount, remaining],
                backgroundColor: ['#4caf50', '#e0e0e0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatCurrency(context.parsed)}`;
                        }
                    }
                }
            }
        }
    });
    
    $('#goalInsightsModal').on('hidden.bs.modal', function() {
        $(this).remove();
    });
}

function deleteGoal(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    if (confirm(`Are you sure you want to delete the goal "${goal.goal_name}"? This action cannot be undone.`)) {
        showLoading();
        $.ajax({
            url: `/api/goals/${goalId}`,
            method: 'DELETE',
            success: function() {
                loadGoals();
                showNotification('Goal deleted successfully', 'success');
                hideLoading();
            },
            error: function() {
                hideLoading();
                showNotification('Error deleting goal', 'error');
            }
        });
    }
}

function validateGoalInputs() {
    const target = parseFloat($('#targetAmount').val());
    const current = parseFloat($('#currentAmount').val()) || 0;
    
    if (target && current > target) {
        $('#currentAmount').addClass('is-invalid');
        showNotification('Current amount cannot exceed target amount', 'error');
        return false;
    } else {
        $('#currentAmount').removeClass('is-invalid');
    }
    return true;
}

// Export functions for global use
window.loadGoals = loadGoals;
window.showUpdateModal = showUpdateModal;
window.updateGoalProgress = updateGoalProgress;
window.deleteGoal = deleteGoal;
window.showGoalInsights = showGoalInsights;
