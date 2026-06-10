from django.urls import path
from . import views
from . import admin_views

urlpatterns = [
    path('register/', views.register),
    path('verify-email/', views.verify_email),
    path('resend-verification/', views.resend_verification),
    path('settings/', views.public_settings),
    path('login/', views.login),
    path('logout/', views.logout),
    path('profile/', views.profile),
    path('profile/update/', views.update_profile),
    path('change-password/', views.change_password),
    path('avatar/', views.upload_avatar),
    path('notifications/', views.notifications_list),
    path('notifications/read/', views.notifications_mark_read),

    # Admin endpoints
    path('admin/stats/', admin_views.admin_stats),
    path('admin/users/', admin_views.admin_users),
    path('admin/users/<int:pk>/', admin_views.admin_user_update),
    path('admin/users/<int:pk>/delete/', admin_views.admin_user_delete),
    path('admin/users/<int:pk>/ban/', admin_views.admin_ban_user),
    path('admin/cars/', admin_views.admin_cars),
    path('admin/cars/<int:pk>/', admin_views.admin_car_update),
    path('admin/cars/<int:pk>/delete/', admin_views.admin_car_delete),
    path('admin/sellers/', admin_views.admin_sellers),
    path('admin/sellers/<int:pk>/verify/', admin_views.admin_seller_verify),
    path('admin/sellers/<int:pk>/premium/', admin_views.admin_seller_premium),
    path('admin/appointments/', admin_views.admin_appointments),
    path('admin/appointments/<int:pk>/', admin_views.admin_appointment_update),
    path('admin/settings/', admin_views.admin_platform_settings),
    path('admin/reports/', admin_views.admin_reports),
    path('admin/reports/<int:pk>/', admin_views.admin_report_update),
    path('admin/audit/', admin_views.admin_audit_log),
]
