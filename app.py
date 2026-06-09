from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
import mysql.connector
from datetime import datetime, timedelta
from decimal import Decimal
import json
from functools import wraps

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database connection function
def get_db_connection():
    try:
        conn = mysql.connector.connect(**Config.DB_CONFIG)
        return conn
    except mysql.connector.Error as e:
        print(f"Database connection error: {e}")
        return None

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username, email, full_name):
        self.id = id
        self.username = username
        self.email = email
        self.full_name = full_name

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, username, email, full_name FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if user:
            return User(user['id'], user['username'], user['email'], user['full_name'])
    return None

# Authentication required decorator for API routes
def api_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE username = %s OR email = %s", (username, username))
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user and check_password_hash(user['password_hash'], password):
                user_obj = User(user['id'], user['username'], user['email'], user['full_name'])
                login_user(user_obj)
                flash('Login successful!', 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Invalid username/email or password', 'danger')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        full_name = request.form.get('full_name')
        
        # Validate input
        if not username or not email or not password:
            flash('All fields are required', 'danger')
            return render_template('register.html')
        
        # Hash password
        password_hash = generate_password_hash(password)
        
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash, full_name) VALUES (%s, %s, %s, %s)",
                    (username, email, password_hash, full_name)
                )
                conn.commit()
                flash('Registration successful! Please login.', 'success')
                return redirect(url_for('login'))
            except mysql.connector.IntegrityError:
                flash('Username or email already exists', 'danger')
            finally:
                cursor.close()
                conn.close()
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/income')
@login_required
def income_page():
    return render_template('income.html')

@app.route('/expense')
@login_required
def expense_page():
    return render_template('expense.html')

@app.route('/budget')
@login_required
def budget_page():
    return render_template('budget.html')

@app.route('/reports')
@login_required
def reports_page():
    return render_template('reports.html')

@app.route('/savings-goals')
@login_required
def savings_goals_page():
    return render_template('savings-goals.html')

@app.route('/profile')
@login_required
def profile_page():
    return render_template('profile.html')

@app.route('/transactions')
@login_required
def transactions_page():
    return render_template('transactions.html')

# API Routes for Income
@app.route('/api/income', methods=['GET'])
@api_login_required
def get_income():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM income WHERE user_id = %s ORDER BY date DESC", (current_user.id,))
    income = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # Convert Decimal to float for JSON serialization
    for item in income:
        item['amount'] = float(item['amount'])
        item['date'] = item['date'].isoformat()
    
    return jsonify(income)

@app.route('/api/income', methods=['POST'])
@api_login_required
def add_income():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO income (user_id, amount, category, description, date) VALUES (%s, %s, %s, %s, %s)",
        (current_user.id, data['amount'], data['category'], data.get('description', ''), data['date'])
    )
    
    # Also add to transactions log
    cursor.execute(
        "INSERT INTO transactions_log (user_id, type, amount, category, description, date) VALUES (%s, 'Income', %s, %s, %s, %s)",
        (current_user.id, data['amount'], data['category'], data.get('description', ''), data['date'])
    )
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Income added successfully'}), 201

@app.route('/api/income/<int:income_id>', methods=['PUT'])
@api_login_required
def update_income(income_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE income SET amount=%s, category=%s, description=%s, date=%s WHERE id=%s AND user_id=%s",
        (data['amount'], data['category'], data.get('description', ''), data['date'], income_id, current_user.id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Income updated successfully'})

@app.route('/api/income/<int:income_id>', methods=['DELETE'])
@api_login_required
def delete_income(income_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM income WHERE id=%s AND user_id=%s", (income_id, current_user.id))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Income deleted successfully'})

# API Routes for Expenses
@app.route('/api/expenses', methods=['GET'])
@api_login_required
def get_expenses():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM expenses WHERE user_id = %s ORDER BY date DESC", (current_user.id,))
    expenses = cursor.fetchall()
    cursor.close()
    conn.close()
    
    for item in expenses:
        item['amount'] = float(item['amount'])
        item['date'] = item['date'].isoformat()
    
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
@api_login_required
def add_expense():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO expenses (user_id, amount, category, description, date) VALUES (%s, %s, %s, %s, %s)",
        (current_user.id, data['amount'], data['category'], data.get('description', ''), data['date'])
    )
    
    # Add to transactions log
    cursor.execute(
        "INSERT INTO transactions_log (user_id, type, amount, category, description, date) VALUES (%s, 'Expense', %s, %s, %s, %s)",
        (current_user.id, data['amount'], data['category'], data.get('description', ''), data['date'])
    )
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Expense added successfully'}), 201

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@api_login_required
def update_expense(expense_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE expenses SET amount=%s, category=%s, description=%s, date=%s WHERE id=%s AND user_id=%s",
        (data['amount'], data['category'], data.get('description', ''), data['date'], expense_id, current_user.id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Expense updated successfully'})

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@api_login_required
def delete_expense(expense_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id=%s AND user_id=%s", (expense_id, current_user.id))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Expense deleted successfully'})

# API Routes for Budgets
@app.route('/api/budgets', methods=['GET'])
@api_login_required
def get_budgets():
    month = request.args.get('month', datetime.now().month)
    year = request.args.get('year', datetime.now().year)
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM budgets WHERE user_id = %s AND month = %s AND year = %s",
        (current_user.id, month, year)
    )
    budgets = cursor.fetchall()
    cursor.close()
    conn.close()
    
    for item in budgets:
        item['amount'] = float(item['amount'])
    
    return jsonify(budgets)

@app.route('/api/budgets', methods=['POST'])
@api_login_required
def set_budget():
    data = request.json
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    # Upsert budget
    cursor.execute(
        """INSERT INTO budgets (user_id, category, amount, month, year) 
           VALUES (%s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE amount = %s""",
        (current_user.id, data['category'], data['amount'], data['month'], data['year'], data['amount'])
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Budget set successfully'}), 201

# API Routes for Dashboard Analytics
@app.route('/api/dashboard/stats')
@api_login_required
def get_dashboard_stats():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    # Get current month's income and expenses
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) as total_income FROM income WHERE user_id = %s AND MONTH(date) = %s AND YEAR(date) = %s",
        (current_user.id, current_month, current_year)
    )
    total_income = cursor.fetchone()['total_income']
    
    cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE user_id = %s AND MONTH(date) = %s AND YEAR(date) = %s",
        (current_user.id, current_month, current_year)
    )
    total_expenses = cursor.fetchone()['total_expenses']
    
    # Get recent transactions
    cursor.execute(
        """SELECT 'Income' as type, amount, category, date FROM income WHERE user_id = %s 
           UNION ALL 
           SELECT 'Expense' as type, amount, category, date FROM expenses WHERE user_id = %s
           ORDER BY date DESC LIMIT 10""",
        (current_user.id, current_user.id)
    )
    recent_transactions = cursor.fetchall()
    
    for trans in recent_transactions:
        trans['amount'] = float(trans['amount'])
        trans['date'] = trans['date'].isoformat()
    
    # Get category-wise expenses for current month
    cursor.execute(
        "SELECT category, SUM(amount) as total FROM expenses WHERE user_id = %s AND MONTH(date) = %s AND YEAR(date) = %s GROUP BY category",
        (current_user.id, current_month, current_year)
    )
    category_expenses = cursor.fetchall()
    
    for item in category_expenses:
        item['total'] = float(item['total'])
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'total_income': float(total_income),
        'total_expenses': float(total_expenses),
        'savings': float(total_income - total_expenses),
        'recent_transactions': recent_transactions,
        'category_expenses': category_expenses
    })

# API Routes for Savings Goals
@app.route('/api/goals', methods=['GET'])
@api_login_required
def get_goals():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM savings_goals WHERE user_id = %s", (current_user.id,))
    goals = cursor.fetchall()
    cursor.close()
    conn.close()
    
    for goal in goals:
        goal['target_amount'] = float(goal['target_amount'])
        goal['current_amount'] = float(goal['current_amount'])
        goal['deadline'] = goal['deadline'].isoformat()
        goal['percentage'] = (goal['current_amount'] / goal['target_amount']) * 100 if goal['target_amount'] > 0 else 0
    
    return jsonify(goals)

@app.route('/api/goals', methods=['POST'])
@api_login_required
def add_goal():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO savings_goals (user_id, goal_name, target_amount, current_amount, deadline) VALUES (%s, %s, %s, %s, %s)",
        (current_user.id, data['goal_name'], data['target_amount'], data.get('current_amount', 0), data['deadline'])
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Goal added successfully'}), 201

@app.route('/api/goals/<int:goal_id>', methods=['PUT'])
@api_login_required
def update_goal(goal_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE savings_goals SET current_amount = %s WHERE id = %s AND user_id = %s",
        (data['current_amount'], goal_id, current_user.id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Goal updated successfully'})

@app.route('/api/goals/<int:goal_id>', methods=['DELETE'])
@api_login_required
def delete_goal(goal_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, current_user.id))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Goal deleted successfully'})

# API Routes for Bill Reminders
@app.route('/api/bills', methods=['GET'])
@api_login_required
def get_bills():
    print("GET /api/bills CALLED")

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            category AS bill_name,
            amount,
            date AS due_date
        FROM expenses
        WHERE user_id = %s
          AND date >= CURDATE()
        ORDER BY date ASC
    """, (current_user.id,))

    bills = cursor.fetchall()

    print("Bills found:", bills)

    cursor.close()
    conn.close()

    for bill in bills:
        bill['amount'] = float(bill['amount'])
        bill['due_date'] = bill['due_date'].isoformat()

    return jsonify(bills)

@app.route('/api/bills', methods=['POST'])
@api_login_required
def add_bill():
    data = request.json

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO bill_reminders 
        (user_id, bill_name, amount, due_date, category, is_paid)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        current_user.id,
        data['bill_name'],
        data.get('amount', 0),
        data['due_date'],
        data.get('category', ''),
        0
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'message': 'Bill added successfully'}), 201

@app.route('/api/bills/<int:bill_id>', methods=['PUT'])
@api_login_required
def update_bill(bill_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE bill_reminders SET is_paid = %s WHERE id = %s AND user_id = %s",
        (data['is_paid'], bill_id, current_user.id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Bill updated successfully'})

@app.route('/api/bills/<int:bill_id>', methods=['DELETE'])
@api_login_required
def delete_bill(bill_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bill_reminders WHERE id = %s AND user_id = %s", (bill_id, current_user.id))
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Bill reminder deleted successfully'})

# API Routes for Reports
@app.route('/api/reports/monthly')
@api_login_required
def get_monthly_report():
    year = request.args.get('year', datetime.now().year)
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    # Monthly income
    cursor.execute(
        "SELECT MONTH(date) as month, SUM(amount) as total FROM income WHERE user_id = %s AND YEAR(date) = %s GROUP BY MONTH(date)",
        (current_user.id, year)
    )
    monthly_income = cursor.fetchall()
    
    # Monthly expenses
    cursor.execute(
        "SELECT MONTH(date) as month, SUM(amount) as total FROM expenses WHERE user_id = %s AND YEAR(date) = %s GROUP BY MONTH(date)",
        (current_user.id, year)
    )
    monthly_expenses = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    income_dict = {item['month']: float(item['total']) for item in monthly_income}
    expense_dict = {item['month']: float(item['total']) for item in monthly_expenses}
    
    months_data = []
    for month in range(1, 13):
        months_data.append({
            'month': month,
            'income': income_dict.get(month, 0),
            'expenses': expense_dict.get(month, 0),
            'savings': income_dict.get(month, 0) - expense_dict.get(month, 0)
        })
    
    return jsonify(months_data)

@app.route('/api/user/profile', methods=['GET'])
@api_login_required
def get_profile():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, email, full_name, phone, currency FROM users WHERE id = %s", (current_user.id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return jsonify(user)

@app.route('/api/user/profile', methods=['PUT'])
@api_login_required
def update_profile():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET full_name = %s, phone = %s, currency = %s WHERE id = %s",
        (data.get('full_name'), data.get('phone'), data.get('currency', 'USD'), current_user.id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'message': 'Profile updated successfully'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)