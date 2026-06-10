from django.urls import path
from . import views

urlpatterns = [
    path('cars/', views.car_list),
    path('cars/create/', views.car_create),
    path('cars/<int:pk>/', views.car_detail),
    path('cars/<int:pk>/edit/', views.car_update),
    path('cars/<int:pk>/images/', views.car_upload_images),
    path('cars/<int:pk>/images/<int:image_id>/', views.car_delete_image),
    path('cars/<int:pk>/images/<int:image_id>/set-primary/', views.car_set_primary_image),
    path('sellers/', views.seller_list),
    path('sellers/<int:pk>/', views.seller_detail),
    path('sellers/<int:seller_id>/reviews/', views.seller_reviews),
    path('sellers/logo/', views.upload_seller_logo),
    path('sellers/premium/request/', views.request_premium),
    path('appointments/', views.appointment_list),
    path('appointments/<int:pk>/', views.appointment_update),
    path('favorites/', views.favorites_list),
    path('favorites/<int:car_id>/toggle/', views.toggle_favorite),
    path('dashboard/seller/', views.seller_dashboard),
    path('cars/<int:car_id>/report/', views.report_car),
    path('conversations/', views.conversation_list),
    path('conversations/<int:conv_id>/messages/', views.conversation_messages),
    path('rental-requests/', views.rental_request_list),
    path('rental-requests/<int:pk>/', views.rental_request_detail),
    path('cars/<int:car_id>/availability/', views.car_rental_availability),
]
