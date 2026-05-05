import { body } from 'express-validator';

// Validation rules for updating kilometer
const updateKilometerValidation = [
    body('kilometer')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_in_out_shifts.please_enter_kilometer'))
        .isFloat()
        .withMessage((value, { req }) => req.__('admin.driver_in_out_shifts.please_enter_valid_kilometer'))
        .custom((value,{req, res, next,location,path})=>{
            if(value && (isNaN(value) || value <0 )){
                return Promise.reject(req.__('admin.driver_in_out_shifts.please_enter_valid_kilometer', { value, location, path }));
            }else{
                return true;
            }
        })
];

export {
    updateKilometerValidation
};