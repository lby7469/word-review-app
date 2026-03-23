#include<iostream>
using namespace std;

class stack{
private:
    int data[100];
    int top;
public:
    stack(){
        top=-1;
    }
    bool insert(int val){
        if(top+1>100){
            return false;
        }
        else{
        data[++top]=val;
        return true;
        }
    }
    bool remove(){
        if(top>0){
        data[top--]=-1;
        return true;
        }
        else{
            return false;
        }
    }
    int gettop(){
        if(top>=0){
            return data[top];
        }
        else{
            return -1;
        }
    }
};


int main(){
    return 0;
}